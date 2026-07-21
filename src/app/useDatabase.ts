/**
 * Hook central : orchestre source de données + persistance + scan + watch.
 * En dehors de Tauri (navigateur), bascule sur le jeu de démonstration (fixtures).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createTauriDataSource } from "@/datasource/tauri";
import { scanFolder, type ImportReport } from "@/datasource/scan";
import { createJsonStorage } from "@/storage/json";
import { DEFAULT_APP_DATA, type AppData } from "@/storage/types";
import type { Tournoi } from "@/parsing/types";
import type { Main } from "@/parsing/handTypes";
import { loadFixtureTournois, loadFixtureMains } from "./fixtures";

const source = createTauriDataSource();
const storage = createJsonStorage();

export type Mode = "loading" | "tauri" | "demo";

export function useDatabase() {
  const [appData, setAppData] = useState<AppData>(DEFAULT_APP_DATA);
  const [demoTournois, setDemoTournois] = useState<Tournoi[]>([]);
  const [demoMains, setDemoMains] = useState<Main[]>([]);
  const [mode, setMode] = useState<Mode>("loading");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  const dataRef = useRef(appData);
  dataRef.current = appData;
  const unwatchRef = useRef<null | (() => void)>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rescanInternal = useCallback(async (folder: string) => {
    setBusy(true);
    try {
      const { data, report } = await scanFolder(source, folder, dataRef.current);
      setAppData(data);
      setReport(report);
      await storage.save(data);
    } finally {
      setBusy(false);
    }
  }, []);

  const startWatch = useCallback(
    (folder: string) => {
      unwatchRef.current?.();
      source
        .watchDir(folder, () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => void rescanInternal(folder), 600);
        })
        .then((un) => {
          unwatchRef.current = un;
        })
        .catch(() => {
          /* watch indisponible → dégradation silencieuse (scan manuel toujours possible) */
        });
    },
    [rescanInternal],
  );

  // Initialisation
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!source.isAvailable()) {
        setDemoTournois(loadFixtureTournois());
        setDemoMains(loadFixtureMains());
        setMode("demo");
        return;
      }
      const loaded = await storage.load();
      if (cancelled) return;
      setMode("tauri");
      const folder = loaded.settings.folder ?? (await source.autoDetectDir());
      if (folder) {
        const { data, report } = await scanFolder(source, folder, loaded);
        if (cancelled) return;
        setAppData(data);
        setReport(report);
        await storage.save(data);
        startWatch(folder);
      } else {
        setAppData(loaded);
      }
    })().catch((e) => {
      console.error("Init base:", e);
      setMode("tauri");
    });
    return () => {
      cancelled = true;
      unwatchRef.current?.();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [startWatch]);

  const pickFolder = useCallback(async () => {
    setBusy(true);
    try {
      const folder = await source.pickDir();
      if (!folder) return;
      const { data, report } = await scanFolder(source, folder, dataRef.current);
      setAppData(data);
      setReport(report);
      await storage.save(data);
      startWatch(folder);
    } finally {
      setBusy(false);
    }
  }, [startWatch]);

  const rescan = useCallback(async () => {
    const folder = dataRef.current.settings.folder;
    if (folder) await rescanInternal(folder);
  }, [rescanInternal]);

  const resetData = useCallback(async () => {
    unwatchRef.current?.();
    const fresh = structuredClone(DEFAULT_APP_DATA);
    fresh.settings.startingBankroll = dataRef.current.settings.startingBankroll;
    setAppData(fresh);
    setReport(null);
    await storage.save(fresh);
  }, []);

  const setStartingBankroll = useCallback(async (n: number) => {
    const data: AppData = {
      ...dataRef.current,
      settings: { ...dataRef.current.settings, startingBankroll: n },
    };
    setAppData(data);
    await storage.save(data);
  }, []);

  const setExternalAdjustment = useCallback(async (n: number) => {
    const data: AppData = {
      ...dataRef.current,
      settings: { ...dataRef.current.settings, externalAdjustment: n },
    };
    setAppData(data);
    await storage.save(data);
  }, []);

  const tournois = mode === "demo" ? demoTournois : Object.values(appData.tournois);
  // Mains triées chronologiquement (puis par n°) pour un rejeu dans l'ordre de jeu.
  const mains =
    mode === "demo"
      ? demoMains
      : Object.values(appData.mains).sort(
          (a, b) => a.startedAt.localeCompare(b.startedAt) || a.numero - b.numero,
        );

  return {
    mode,
    busy,
    report,
    tournois,
    mains,
    folder: appData.settings.folder,
    lastScan: appData.settings.lastScan,
    startingBankroll: mode === "demo" ? 50 : appData.settings.startingBankroll,
    externalAdjustment: mode === "demo" ? 0 : appData.settings.externalAdjustment,
    pickFolder,
    rescan,
    resetData,
    setStartingBankroll,
    setExternalAdjustment,
  };
}
