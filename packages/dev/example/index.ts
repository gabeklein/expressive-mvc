import { config } from "@expressive/dev/server";

export default config({
  port: Number(process.env.PORT) || 3100,
});
