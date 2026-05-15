import { EventEmitter } from "node:events";

export interface InspectionStreamEvent {
  entityId: string;
  entityType: "inspection";
  eventType:
    | "inspection.assigned"
    | "inspection.status_updated"
    | "inspection.finding_logged";
  lguId?: string;
  officeId: string;
  payload: Record<string, unknown>;
}

class InspectionEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  publish(event: InspectionStreamEvent) {
    this.emit("event", event);
  }

  subscribe(handler: (event: InspectionStreamEvent) => void) {
    this.on("event", handler);

    return () => {
      this.off("event", handler);
    };
  }
}

export const inspectionEventBus = new InspectionEventBus();
