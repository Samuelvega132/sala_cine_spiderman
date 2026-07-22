import type { Config } from "tailwindcss";
const config: Config = { content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"], theme: { extend: { colors: { spider: "#E50914", neon: "#00F0FF" }, boxShadow: { neon: "0 0 24px rgba(0,240,255,.3)", red: "0 0 30px rgba(229,9,20,.35)" } } }, plugins: [] };
export default config;
