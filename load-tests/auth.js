/**
 * k6 load test — Authentication endpoints
 *
 * Run:  k6 run load-tests/auth.js --env BASE_URL=http://localhost:3000
 *
 * Simulates 50 concurrent users authenticating over 2 minutes, matching a
 * realistic LGU morning shift login surge.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

export const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "30s", target: 10 },   // ramp up
    { duration: "1m",  target: 50 },   // hold at peak
    { duration: "30s", target: 0  },   // ramp down
  ],
  thresholds: {
    http_req_failed:   ["rate<0.01"],  // < 1% failure
    http_req_duration: ["p(95)<500"],  // p95 < 500 ms
    errors:            ["rate<0.05"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: "admin@inspectph.test", password: "TestPassword1!" }),
    { headers: { "Content-Type": "application/json" } },
  );

  const ok = check(loginRes, {
    "login 200": (r) => r.status === 200,
    "has accessToken": (r) => {
      try {
        return !!JSON.parse(r.body).data.accessToken;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!ok);
  sleep(1);
}
