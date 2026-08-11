import { useEffect, useState, createContext, useContext } from "react";
import api from "@/lib/api";

const SiteContext = createContext({ settings: {}, loading: true });

export function SiteProvider({ children }) {
  const [settings, setSettings] = useState({ site_name: "Kamil Yıldırım Akademi" });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/settings/public").then(({ data }) => setSettings(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return <SiteContext.Provider value={{ settings, loading }}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
