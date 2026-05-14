import type { AuthTokenPayload } from "../lib/jwt.js";
import type { JurisdictionScope } from "../middleware/jurisdiction.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
      jurisdictionScope?: JurisdictionScope;
    }
  }
}

export {};
