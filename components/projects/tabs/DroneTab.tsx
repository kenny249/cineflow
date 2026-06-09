"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DroneIcon } from "@/components/icons/DroneIcon";
import { Moon, TriangleAlert, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ShotListItem } from "@/types";

interface DroneEquipmentBasic {
  id: string;
  make: string;
  model: string;
  nickname?: string | null;
}

interface FlightLog {
  id: string;
  drone_id: string;
  project_id?: string | null;
  flight_date: string;
  duration_minutes: number;
  location?: string | null;
  preflight_complete: boolean;
  is_night_flight: boolean;
  incident_flag: boolean;
  laanc_auth_code?: string | null;
  notes?: string | null;
  drone?: DroneEquipmentBasic;
}

interface DroneTabProps {
  projectId: string;
  droneShots: ShotListItem[];
}

export function DroneTab({ projectId, droneShots }: DroneTabProps) {
  const supabase = createClient();
  const [flights, setFlights] = useState<FlightLog[]>([]);
  const [drones, setDrones] = useState<DroneEquipmentBasic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: dronesData }, { data: flightsData }] = await Promise.all([
        supabase
          .from("drone_equipment")
          .select("id, make, model, nickname")
          .eq("user_id", user.id)
          .order("make"),
        supabase
          .from("drone_flight_logs")
          .select("*, drone:drone_equipment(id, make, model, nickname)")
          .eq("user_id", user.id)
          .eq("project_id", projectId)
          .order("flight_date", { ascending: false }),
      ]);

      setDrones((dronesData ?? []) as DroneEquipmentBasic[]);
      setFlights((flightsData ?? []) as FlightLog[]);
      setLoading(false);
    }
    load();
  }, [projectId]);

  const totalMinutes = flights.reduce((sum, f) => sum + (f.duration_minutes ?? 0), 0);
  const preflightRate = flights.length
    ? Math.round((flights.filter((f) => f.preflight_complete).length / flights.length) * 100)
    : 0;
  const incidents = flights.filter((f) => f.incident_flag).length;
  const nightFlights = flights.filter((f) => f.is_night_flight).length;

  const droneName = (f: FlightLog) => {
    if (f.drone) {
      const nick = f.drone.nickname;
      return nick ? `${nick} (${f.drone.make} ${f.drone.model})` : `${f.drone.make} ${f.drone.model}`;
    }
    return "—";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Loading drone data…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
            <DroneIcon className="h-4 w-4 text-[#d4a853]" />
            Drone Operations
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Flight logs linked to this project + planned drone shots.
          </p>
        </div>
        <Link
          href="/drones"
          className="flex items-center gap-1 rounded-lg border border-border bg-card/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-[#d4a853]/40 transition-all"
        >
          <ExternalLink className="h-3 w-3" />
          Drone Module
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Air Time", value: `${totalMinutes} min`, sub: `${flights.length} flight${flights.length !== 1 ? "s" : ""}` },
          { label: "Pre-flight Rate", value: `${preflightRate}%`, sub: "complete" },
          { label: "Drone Shots Planned", value: droneShots.length.toString(), sub: `${droneShots.filter(s => s.is_complete).length} done` },
          { label: "Incidents", value: incidents.toString(), sub: incidents > 0 ? "flagged" : "none" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card/50 p-3"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-lg font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Drone shots planned */}
      {droneShots.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Planned Drone Shots</p>
          <div className="space-y-1.5">
            {droneShots.map((shot) => (
              <div
                key={shot.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/10 px-3 py-2"
              >
                {shot.is_complete
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                }
                <span className={`flex-1 text-xs ${shot.is_complete ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  #{shot.shot_number} — {shot.description}
                </span>
                {shot.scene && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">{shot.scene}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flight log table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Flight Logs for This Project</p>
          {nightFlights > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-indigo-400">
              <Moon className="h-3 w-3" />
              {nightFlights} night flight{nightFlights !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {flights.length === 0 ? (
          <div className="rounded-xl border border-border border-dashed bg-card/20 py-10 text-center">
            <DroneIcon className="mx-auto h-7 w-7 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No flight logs linked to this project yet.</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              When logging a flight in the Drone module, select this project from the "Link to Project" dropdown.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Drone</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Location</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Duration</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Pre-flight</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Flags</th>
                </tr>
              </thead>
              <tbody>
                {flights.map((f) => (
                  <tr key={f.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-3 py-2 text-foreground">{f.flight_date}</td>
                    <td className="px-3 py-2 text-foreground">{droneName(f)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{f.location || "—"}</td>
                    <td className="px-3 py-2 text-center text-foreground">{f.duration_minutes} min</td>
                    <td className="px-3 py-2 text-center">
                      {f.preflight_complete
                        ? <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-400" aria-label="Pre-flight complete" />
                        : <Circle className="inline h-3.5 w-3.5 text-muted-foreground/40" aria-label="Pre-flight incomplete" />
                      }
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        {f.is_night_flight && <Moon className="h-3.5 w-3.5 text-indigo-400" aria-label="Night flight" />}
                        {f.incident_flag && <TriangleAlert className="h-3.5 w-3.5 text-red-400" aria-label="Incident flagged" />}
                        {f.laanc_auth_code && (
                          <span className="font-mono text-[10px] text-[#d4a853]/80 bg-[#d4a853]/10 px-1 py-0.5 rounded">
                            LAANC: {f.laanc_auth_code}
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Linked drones summary */}
      {drones.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Your Registered Drones</p>
          <div className="flex flex-wrap gap-2">
            {drones.map((d) => (
              <span
                key={d.id}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground"
              >
                <DroneIcon className="h-3 w-3" />
                {d.nickname ?? `${d.make} ${d.model}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
