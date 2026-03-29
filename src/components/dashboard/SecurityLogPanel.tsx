import { useEffect, useState } from "react";
import { getSecurityLog, type SecurityEvent } from "@/security/sanitizer";

const SecurityLogPanel = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  useEffect(() => {
    const update = () => setEvents(getSecurityLog().slice(0, 5));
    update();
    const interval = setInterval(update, 2000);
    return () => clearInterval(interval);
  }, []);

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No security events</p>;
  }

  return (
    <div className="space-y-2">
      {events.map((event, i) => (
        <div key={`${event.timestamp}-${i}`} className="border border-destructive/30 bg-destructive/5 p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-destructive uppercase">{event.severity}</span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-xs font-mono text-foreground mt-1">
            Field: <span className="text-destructive">{event.field}</span>
          </p>
          <p className="text-[10px] font-mono text-muted-foreground">
            Patterns: {event.patterns.join(", ")}
          </p>
        </div>
      ))}
    </div>
  );
};

export default SecurityLogPanel;
