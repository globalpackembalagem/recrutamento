import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeDateKey(dateStr: unknown): string {
  if (!dateStr) return "";
  const str = String(dateStr).trim();
  if (!str) return "";
  if (str.includes("T")) return normalizeDateKey(str.split("T")[0]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{3}-\d{2}-\d{2}$/.test(str)) return `${str.slice(0, 2)}2${str.slice(2)}`;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str)) {
    const [dayRaw, monthRaw, yearRaw] = str.split("/");
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw.length === 3 ? `${yearRaw.slice(0, 2)}2${yearRaw.slice(2)}` : yearRaw;
    return `${year}-${monthRaw.padStart(2, "0")}-${dayRaw.padStart(2, "0")}`;
  }
  return str;
}

export function isSameDateKey(a: unknown, b: unknown): boolean {
  const left = normalizeDateKey(a);
  const right = normalizeDateKey(b);
  return !!left && !!right && left === right;
}

export type Origem = "agencia" | "direto" | null;

export function parseOrigem(indicacao?: string): { origem: Origem; nome: string } {
  if (!indicacao) return { origem: null, nome: "" };
  const s = indicacao.trim();
  if (s.startsWith("AGENCIA|")) return { origem: "agencia", nome: s.slice(8).trim() };
  if (s.startsWith("DIRETO|")) return { origem: "direto", nome: s.slice(7).trim() };
  return { origem: "agencia", nome: s };
}

export function buildIndicacao(origem: Origem, nome: string): string {
  const n = (nome || "").trim();
  if (!origem) return n;
  const prefix = origem === "agencia" ? "AGENCIA|" : "DIRETO|";
  return prefix + n;
}

export function formatIndicacao(indicacao?: string): string {
  const { origem, nome } = parseOrigem(indicacao);
  if (!origem && !nome) return "";
  const label = origem === "agencia" ? "Agência" : origem === "direto" ? "Direto" : "";
  if (label && nome) return `${label} - ${nome}`;
  return label || nome;
}

export function formatDate(dateStr: unknown) {
  if (!dateStr) return "—";
  
  // If it's already a Date object
  if (dateStr instanceof Date) {
    const day = String(dateStr.getDate()).padStart(2, "0");
    const month = String(dateStr.getMonth() + 1).padStart(2, "0");
    const year = dateStr.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const str = String(dateStr).trim();
  
  try {
    // If it's DD/MM/YYYY
    if (str.includes("/")) {
      const parts = str.split("/");
      if (parts.length === 3) {
        // Return exactly DD/MM/YYYY with slashes
        return str.replace(/-/g, "/"); 
      }
    }

    // If it's YYYY-MM-DD
    if (str.includes("-")) {
      const parts = str.split("-");
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD to DD/MM/YYYY
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        // Handle other hyphen formats to slashes
        return str.replace(/-/g, "/");
      }
    }
    
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    return str.replace(/-/g, "/");
  } catch (e) {
    return str.replace(/-/g, "/");
  }
}
