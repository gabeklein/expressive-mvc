import { defineConfig } from "vite";
import rpc from "@expressive/rpc/vite";

export default defineConfig({ plugins: [rpc()] });
