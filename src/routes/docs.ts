import { Router } from "express";
import swaggerUi from "swagger-ui-express";

import spec from "../lib/openapi.js";

const router = Router();

router.use("/", swaggerUi.serve);
router.get("/", swaggerUi.setup(spec, { explorer: false }));

export default router;
