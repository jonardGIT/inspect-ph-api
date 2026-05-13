import app, { validateAppStartup } from "./app.js";

const env = validateAppStartup();

const port = env.port;

app.listen(port, () => {
  console.log(`inspect-ph-api listening on port ${port}`);
});
