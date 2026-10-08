import { config } from "@expressive/dev";

export default config({
  port: Number(process.env.PORT) || 3100,
});
