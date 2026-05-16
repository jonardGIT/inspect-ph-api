/**
 * k6 load test — Inspections list endpoint
 *
 * Run:  k6 run load-tests/inspections.js \
 *         --env BASE_URL=http://localhost:3000 \
 *         --env TOKEN=<admin JWT>
 *
 * Simulates 100 concurrent field inspectors polling their assigned inspections
 * — a realistic peak during a city-wide inspection day.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

export const errorRate = new Rate("errors");
export const listDuration = new Trend("inspection_list_duration");

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "2m", target: 100 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
    inspection_list_duration: ["p(99)<1200"],
    errors: ["rate<0.05"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TOKEN = __ENV.TOKEN || "";

export default function () {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };

  // Paginated inspection list
  const listRes = http.get(`${BASE_URL}/api/v1/inspections?page=1&limit=20`, {
    headers,
  });

  const ok = check(listRes, {
    "inspections list 200": (r) => r.status === 200,
    "has data array": (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).data);
      } catch {
        return false;
      }
    },
  });

  listDuration.add(listRes.timings.duration);
  errorRate.add(!ok);

  sleep(0.5);

  // Single inspection detail
  let inspectionId;
  try {
    const body = JSON.parse(listRes.body);
    inspectionId = body.data?.[0]?.id;
  } catch {
    /* ignore */
  }

  if (inspectionId) {
    const detailRes = http.get(
      `${BASE_URL}/api/v1/inspections/${inspectionId}`,
      { headers },
    );
    check(detailRes, { "inspection detail 200": (r) => r.status === 200 });
  }

  sleep(1);
}
