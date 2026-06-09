"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plane, Plus, Trash2, Pencil, Battery, ClipboardCheck,
  Wrench, ShieldCheck, ChevronDown, AlertTriangle, CheckCircle2,
  Circle, Clock, MapPin, Timer, ArrowUp, CloudSun, Wind,
  Eye, Thermometer, FolderKanban, StickyNote, X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  DroneEquipment, DroneBattery, DroneFlightLog, DroneMaintenanceLog,
  DroneStatus, DroneBatteryStatus, Project,
} from "@/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const PREFLIGHT_ITEMS: { key: string; label: string }[] = [
  { key: "airspace",        label: "Airspace authorization confirmed (LAANC or FAA DroneZone waiver)" },
  { key: "tfr",             label: "TFRs checked — no Temporary Flight Restrictions in effect" },
  { key: "weather",         label: "Weather assessed — wind <23 mph, visibility >3 miles" },
  { key: "aircraft_inspect",label: "Aircraft physically inspected — no visible damage" },
  { key: "props",           label: "Propellers secure, undamaged, and correctly installed" },
  { key: "battery_charge",  label: "Flight battery charged and health confirmed" },
  { key: "controller",      label: "Remote controller charged" },
  { key: "sd_card",         label: "SD card inserted and formatted" },
  { key: "rth",             label: "Return-to-home altitude and point configured" },
  { key: "compass",         label: "Compass calibrated (if new location)" },
  { key: "gimbal",          label: "Gimbal and camera verified functional" },
  { key: "site",            label: "Takeoff site assessed — clear of people, obstacles, power lines" },
];

const MAINTENANCE_TYPES = [
  "Propeller replacement", "Motor service", "Firmware update",
  "Gimbal calibration", "Battery service", "Frame repair",
  "Camera/sensor cleaning", "ESC replacement", "General inspection",
  "Pre-season service", "Other",
];

const WEATHER_CONDITIONS = [
  "Clear", "Partly cloudy", "Overcast", "Light wind", "Gusty",
  "Hazy", "Fog (cleared)", "Light rain (ceased)", "Golden hour", "Other",
];

const DRONE_PURPOSES = [
  "Aerial coverage", "Establishing shot", "Location scout",
  "Real estate", "Event coverage", "Documentary", "Commercial",
  "FPV / action", "Inspection", "Test flight", "Other",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function batteryHealth(cycles: number) {
  if (cycles <= 150) return { label: "Healthy",  color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", bar: "bg-emerald-400", pct: Math.min(cycles / 400 * 100, 100) };
  if (cycles <= 300) return { label: "Caution",  color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-400/30",   bar: "bg-amber-400",   pct: Math.min(cycles / 400 * 100, 100) };
  return               { label: "Replace",  color: "text-red-400",     bg: "bg-red-400/10 border-red-400/30",       bar: "bg-red-400",     pct: 100 };
}

function part107DaysLeft(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}

function droneLabel(d: DroneEquipment) {
  return d.nickname ? `${d.nickname} (${d.make} ${d.model})` : `${d.make} ${d.model}`;
}

function numVal(s: string): number | null {
  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function centsFromDollars(s: string): number | null {
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return isNaN(n) ? null : Math.round(n * 100);
}

const STATUS_BADGE: Record<DroneStatus, string> = {
  active:    "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
  in_repair: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  retired:   "bg-zinc-400/10 text-zinc-400 border-zinc-400/20",
};
const STATUS_LABEL: Record<DroneStatus, string> = {
  active: "Active", in_repair: "In Repair", retired: "Retired",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
        active ? "bg-[#d4a853]/10 text-[#d4a853] ring-[0.5px] ring-inset ring-[#d4a853]/20"
               : "text-zinc-400 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function SelectField({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-md border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc, action }: {
  icon: React.ElementType; title: string; desc: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border">
        <Icon className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{desc}</p>
      {action}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Tab = "equipment" | "batteries" | "flights" | "maintenance" | "part107";

export default function DronesPage() {
  const supabase = createClient();

  // ── State ──
  const [tab, setTab] = useState<Tab>("equipment");
  const [drones, setDrones] = useState<DroneEquipment[]>([]);
  const [batteries, setBatteries] = useState<DroneBattery[]>([]);
  const [flights, setFlights] = useState<DroneFlightLog[]>([]);
  const [maintenance, setMaintenance] = useState<DroneMaintenanceLog[]>([]);
  const [projects, setProjects] = useState<Pick<Project, "id" | "title">[]>([]);
  const [part107Number, setPart107Number] = useState("");
  const [part107Expires, setPart107Expires] = useState("");
  const [part107Saving, setPart107Saving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");

  // Dialogs
  const [droneOpen, setDroneOpen] = useState(false);
  const [batteryOpen, setBatteryOpen] = useState(false);
  const [flightOpen, setFlightOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editing
  const [editDrone, setEditDrone] = useState<DroneEquipment | null>(null);
  const [editBattery, setEditBattery] = useState<DroneBattery | null>(null);
  const [editFlight, setEditFlight] = useState<DroneFlightLog | null>(null);
  const [editMaintenance, setEditMaintenance] = useState<DroneMaintenanceLog | null>(null);

  // ── Equipment form ──
  const [fMake, setFMake] = useState("");
  const [fModel, setFModel] = useState("");
  const [fNickname, setFNickname] = useState("");
  const [fSerial, setFSerial] = useState("");
  const [fFaaReg, setFFaaReg] = useState("");
  const [fPurchaseDate, setFPurchaseDate] = useState("");
  const [fDroneStatus, setFDroneStatus] = useState<DroneStatus>("active");
  const [fDroneNotes, setFDroneNotes] = useState("");

  // ── Battery form ──
  const [bLabel, setBLabel] = useState("");
  const [bDroneId, setBDroneId] = useState("");
  const [bSerial, setBSerial] = useState("");
  const [bPurchaseDate, setBPurchaseDate] = useState("");
  const [bCycles, setBCycles] = useState("0");
  const [bCapacity, setBCapacity] = useState("");
  const [bBattStatus, setBBattStatus] = useState<DroneBatteryStatus>("active");

  // ── Flight form ──
  const [flDate, setFlDate] = useState("");
  const [flDroneId, setFlDroneId] = useState("");
  const [flLocation, setFlLocation] = useState("");
  const [flDuration, setFlDuration] = useState("");
  const [flAltitude, setFlAltitude] = useState("");
  const [flPurpose, setFlPurpose] = useState("");
  const [flWeather, setFlWeather] = useState("");
  const [flWind, setFlWind] = useState("");
  const [flVisibility, setFlVisibility] = useState("");
  const [flTemp, setFlTemp] = useState("");
  const [flProjectId, setFlProjectId] = useState("");
  const [flNotes, setFlNotes] = useState("");
  const [flChecklist, setFlChecklist] = useState<Record<string, boolean>>({});
  const [flBatteries, setFlBatteries] = useState<string[]>([]);

  // ── Maintenance form ──
  const [mDroneId, setMDroneId] = useState("");
  const [mDate, setMDate] = useState("");
  const [mType, setMType] = useState(MAINTENANCE_TYPES[0]);
  const [mDesc, setMDesc] = useState("");
  const [mCost, setMCost] = useState("");
  const [mNextDate, setMNextDate] = useState("");

  // ── Load ──
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [
        { data: dronesData },
        { data: batsData },
        { data: flightsData },
        { data: maintData },
        { data: projData },
        { data: profileData },
      ] = await Promise.all([
        supabase.from("drone_equipment").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("drone_batteries").select("*, drone:drone_equipment(id, make, model)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("drone_flight_logs").select("*, drone:drone_equipment(id, make, model), project:projects(id, title), batteries:drone_flight_batteries(battery:drone_batteries(id, label, cycle_count))").eq("user_id", user.id).order("flight_date", { ascending: false }),
        supabase.from("drone_maintenance_logs").select("*, drone:drone_equipment(id, make, model)").eq("user_id", user.id).order("maintenance_date", { ascending: false }),
        supabase.from("projects").select("id, title").eq("user_id", user.id).order("title"),
        supabase.from("profiles").select("part107_number, part107_expires_at").eq("id", user.id).single(),
      ]);

      setDrones((dronesData as DroneEquipment[]) ?? []);
      setBatteries((batsData as DroneBattery[]) ?? []);
      setFlights((flightsData as DroneFlightLog[]) ?? []);
      setMaintenance((maintData as DroneMaintenanceLog[]) ?? []);
      setProjects((projData as Pick<Project, "id" | "title">[]) ?? []);
      if (profileData) {
        setPart107Number(profileData.part107_number ?? "");
        setPart107Expires(profileData.part107_expires_at ?? "");
      }
    } catch {
      toast.error("Failed to load drone data");
    } finally {
      setLoading(false);
    }
  }

  // ── Equipment CRUD ──

  function openDroneDialog(drone?: DroneEquipment) {
    setEditDrone(drone ?? null);
    setFMake(drone?.make ?? "");
    setFModel(drone?.model ?? "");
    setFNickname(drone?.nickname ?? "");
    setFSerial(drone?.serial_number ?? "");
    setFFaaReg(drone?.faa_registration ?? "");
    setFPurchaseDate(drone?.purchase_date ?? "");
    setFDroneStatus(drone?.status ?? "active");
    setFDroneNotes(drone?.notes ?? "");
    setDroneOpen(true);
  }

  const saveDrone = useCallback(async () => {
    if (!fMake.trim() || !fModel.trim()) return toast.error("Make and model are required");
    setSaving(true);
    try {
      const payload = {
        make: fMake.trim(), model: fModel.trim(),
        nickname: fNickname.trim() || null, serial_number: fSerial.trim() || null,
        faa_registration: fFaaReg.trim() || null, purchase_date: fPurchaseDate || null,
        status: fDroneStatus, notes: fDroneNotes.trim() || null,
      };
      if (editDrone) {
        const { data, error } = await supabase.from("drone_equipment").update(payload).eq("id", editDrone.id).select().single();
        if (error) throw error;
        setDrones((prev) => prev.map((d) => d.id === editDrone.id ? data as DroneEquipment : d));
        toast.success("Drone updated");
      } else {
        const { data, error } = await supabase.from("drone_equipment").insert({ ...payload, user_id: userId }).select().single();
        if (error) throw error;
        setDrones((prev) => [data as DroneEquipment, ...prev]);
        toast.success("Drone added");
      }
      setDroneOpen(false);
    } catch { toast.error("Failed to save drone"); }
    finally { setSaving(false); }
  }, [fMake, fModel, fNickname, fSerial, fFaaReg, fPurchaseDate, fDroneStatus, fDroneNotes, editDrone, userId]);

  async function deleteDrone(id: string) {
    if (!confirm("Delete this drone? All associated flights and maintenance logs will also be deleted.")) return;
    await supabase.from("drone_equipment").delete().eq("id", id);
    setDrones((prev) => prev.filter((d) => d.id !== id));
    setFlights((prev) => prev.filter((f) => f.drone_id !== id));
    setMaintenance((prev) => prev.filter((m) => m.drone_id !== id));
    toast.success("Drone deleted");
  }

  // ── Battery CRUD ──

  function openBatteryDialog(battery?: DroneBattery) {
    setEditBattery(battery ?? null);
    setBLabel(battery?.label ?? "");
    setBDroneId(battery?.drone_id ?? "");
    setBSerial(battery?.serial_number ?? "");
    setBPurchaseDate(battery?.purchase_date ?? "");
    setBCycles(String(battery?.cycle_count ?? 0));
    setBCapacity(battery?.capacity_mah ? String(battery.capacity_mah) : "");
    setBBattStatus(battery?.status ?? "active");
    setBatteryOpen(true);
  }

  const saveBattery = useCallback(async () => {
    if (!bLabel.trim()) return toast.error("Battery label is required");
    setSaving(true);
    try {
      const payload = {
        label: bLabel.trim(), drone_id: bDroneId || null,
        serial_number: bSerial.trim() || null, purchase_date: bPurchaseDate || null,
        cycle_count: numVal(bCycles) ?? 0,
        capacity_mah: numVal(bCapacity),
        status: bBattStatus,
      };
      if (editBattery) {
        const { data, error } = await supabase.from("drone_batteries").update(payload).eq("id", editBattery.id)
          .select("*, drone:drone_equipment(id, make, model)").single();
        if (error) throw error;
        setBatteries((prev) => prev.map((b) => b.id === editBattery.id ? data as DroneBattery : b));
        toast.success("Battery updated");
      } else {
        const { data, error } = await supabase.from("drone_batteries").insert({ ...payload, user_id: userId })
          .select("*, drone:drone_equipment(id, make, model)").single();
        if (error) throw error;
        setBatteries((prev) => [data as DroneBattery, ...prev]);
        toast.success("Battery added");
      }
      setBatteryOpen(false);
    } catch { toast.error("Failed to save battery"); }
    finally { setSaving(false); }
  }, [bLabel, bDroneId, bSerial, bPurchaseDate, bCycles, bCapacity, bBattStatus, editBattery, userId]);

  async function deleteBattery(id: string) {
    if (!confirm("Delete this battery?")) return;
    await supabase.from("drone_batteries").delete().eq("id", id);
    setBatteries((prev) => prev.filter((b) => b.id !== id));
    toast.success("Battery deleted");
  }

  // ── Flight CRUD ──

  function openFlightDialog(flight?: DroneFlightLog) {
    setEditFlight(flight ?? null);
    const today = new Date().toISOString().split("T")[0];
    setFlDate(flight?.flight_date ?? today);
    setFlDroneId(flight?.drone_id ?? "");
    setFlLocation(flight?.location ?? "");
    setFlDuration(flight ? String(flight.duration_minutes) : "");
    setFlAltitude(flight?.max_altitude_ft ? String(flight.max_altitude_ft) : "");
    setFlPurpose(flight?.purpose ?? "");
    setFlWeather(flight?.weather_conditions ?? "");
    setFlWind(flight?.wind_speed_mph ? String(flight.wind_speed_mph) : "");
    setFlVisibility(flight?.visibility_miles ? String(flight.visibility_miles) : "");
    setFlTemp(flight?.temperature_f ? String(flight.temperature_f) : "");
    setFlProjectId(flight?.project_id ?? "");
    setFlNotes(flight?.notes ?? "");
    setFlChecklist(flight?.preflight_items ?? {});
    setFlBatteries(flight?.batteries?.map((b) => b.battery.id) ?? []);
    setFlightOpen(true);
  }

  const saveFlight = useCallback(async () => {
    if (!flLocation.trim()) return toast.error("Location is required");
    if (!flDuration.trim()) return toast.error("Duration is required");
    setSaving(true);
    try {
      const preflightCompleted = PREFLIGHT_ITEMS.every((item) => flChecklist[item.key]);
      const payload = {
        drone_id: flDroneId || null,
        project_id: flProjectId || null,
        flight_date: flDate,
        location: flLocation.trim(),
        duration_minutes: numVal(flDuration) ?? 0,
        max_altitude_ft: numVal(flAltitude),
        purpose: flPurpose || null,
        weather_conditions: flWeather || null,
        wind_speed_mph: numVal(flWind),
        visibility_miles: numVal(flVisibility),
        temperature_f: numVal(flTemp),
        preflight_completed: preflightCompleted,
        preflight_items: flChecklist,
        notes: flNotes.trim() || null,
      };

      let flightId: string;

      if (editFlight) {
        const { data, error } = await supabase.from("drone_flight_logs").update(payload).eq("id", editFlight.id)
          .select("*, drone:drone_equipment(id, make, model), project:projects(id, title), batteries:drone_flight_batteries(battery:drone_batteries(id, label, cycle_count))").single();
        if (error) throw error;
        setFlights((prev) => prev.map((f) => f.id === editFlight.id ? data as DroneFlightLog : f));
        flightId = editFlight.id;
        toast.success("Flight updated");
      } else {
        const { data, error } = await supabase.from("drone_flight_logs").insert({ ...payload, user_id: userId })
          .select("*, drone:drone_equipment(id, make, model), project:projects(id, title), batteries:drone_flight_batteries(battery:drone_batteries(id, label, cycle_count))").single();
        if (error) throw error;
        flightId = (data as DroneFlightLog).id;

        // Link batteries + increment cycle counts
        if (flBatteries.length > 0) {
          await supabase.from("drone_flight_batteries").insert(
            flBatteries.map((bid) => ({ flight_id: flightId, battery_id: bid }))
          );
          for (const bid of flBatteries) {
            const bat = batteries.find((b) => b.id === bid);
            if (bat) {
              await supabase.from("drone_batteries").update({ cycle_count: bat.cycle_count + 1 }).eq("id", bid);
            }
          }
          // Refresh batteries to reflect updated cycle counts
          const { data: refreshed } = await supabase.from("drone_batteries")
            .select("*, drone:drone_equipment(id, make, model)").eq("user_id", userId).order("created_at", { ascending: false });
          if (refreshed) setBatteries(refreshed as DroneBattery[]);
        }

        // Re-fetch the flight with batteries included
        const { data: withBats } = await supabase.from("drone_flight_logs")
          .select("*, drone:drone_equipment(id, make, model), project:projects(id, title), batteries:drone_flight_batteries(battery:drone_batteries(id, label, cycle_count))")
          .eq("id", flightId).single();
        if (withBats) setFlights((prev) => [withBats as DroneFlightLog, ...prev]);
        else setFlights((prev) => [data as DroneFlightLog, ...prev]);

        toast.success("Flight logged");
        setFlightOpen(false);
        setSaving(false);
        return;
      }

      setFlightOpen(false);
    } catch { toast.error("Failed to save flight"); }
    finally { setSaving(false); }
  }, [flDate, flDroneId, flLocation, flDuration, flAltitude, flPurpose, flWeather, flWind, flVisibility, flTemp, flProjectId, flNotes, flChecklist, flBatteries, editFlight, userId, batteries]);

  async function deleteFlight(id: string) {
    if (!confirm("Delete this flight log? Battery cycle counts will not be reversed.")) return;
    await supabase.from("drone_flight_logs").delete().eq("id", id);
    setFlights((prev) => prev.filter((f) => f.id !== id));
    toast.success("Flight deleted");
  }

  // ── Maintenance CRUD ──

  function openMaintenanceDialog(log?: DroneMaintenanceLog) {
    setEditMaintenance(log ?? null);
    const today = new Date().toISOString().split("T")[0];
    setMDroneId(log?.drone_id ?? "");
    setMDate(log?.maintenance_date ?? today);
    setMType(log?.maintenance_type ?? MAINTENANCE_TYPES[0]);
    setMDesc(log?.description ?? "");
    setMCost(log?.cost_cents ? String(log.cost_cents / 100) : "");
    setMNextDate(log?.next_maintenance_date ?? "");
    setMaintenanceOpen(true);
  }

  const saveMaintenance = useCallback(async () => {
    if (!mDroneId) return toast.error("Select a drone");
    setSaving(true);
    try {
      const payload = {
        drone_id: mDroneId, maintenance_date: mDate, maintenance_type: mType,
        description: mDesc.trim() || null, cost_cents: centsFromDollars(mCost),
        next_maintenance_date: mNextDate || null,
      };
      if (editMaintenance) {
        const { data, error } = await supabase.from("drone_maintenance_logs").update(payload).eq("id", editMaintenance.id)
          .select("*, drone:drone_equipment(id, make, model)").single();
        if (error) throw error;
        setMaintenance((prev) => prev.map((m) => m.id === editMaintenance.id ? data as DroneMaintenanceLog : m));
        toast.success("Maintenance updated");
      } else {
        const { data, error } = await supabase.from("drone_maintenance_logs").insert({ ...payload, user_id: userId })
          .select("*, drone:drone_equipment(id, make, model)").single();
        if (error) throw error;
        setMaintenance((prev) => [data as DroneMaintenanceLog, ...prev]);
        toast.success("Maintenance logged");
      }
      setMaintenanceOpen(false);
    } catch { toast.error("Failed to save maintenance log"); }
    finally { setSaving(false); }
  }, [mDroneId, mDate, mType, mDesc, mCost, mNextDate, editMaintenance, userId]);

  async function deleteMaintenance(id: string) {
    if (!confirm("Delete this maintenance record?")) return;
    await supabase.from("drone_maintenance_logs").delete().eq("id", id);
    setMaintenance((prev) => prev.filter((m) => m.id !== id));
    toast.success("Deleted");
  }

  // ── Part 107 ──

  async function savePart107() {
    setPart107Saving(true);
    try {
      await supabase.from("profiles").update({
        part107_number: part107Number.trim() || null,
        part107_expires_at: part107Expires || null,
      }).eq("id", userId);
      toast.success("Part 107 info saved");
    } catch { toast.error("Failed to save"); }
    finally { setPart107Saving(false); }
  }

  // ── Checklist helpers ──
  const checklistComplete = PREFLIGHT_ITEMS.every((i) => flChecklist[i.key]);
  const checklistCount = PREFLIGHT_ITEMS.filter((i) => flChecklist[i.key]).length;

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Drones</h1>
          <p className="text-xs text-muted-foreground">Equipment, batteries, flight logs, maintenance, and Part 107.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border px-6 py-2">
        <TabButton active={tab === "equipment"}   onClick={() => setTab("equipment")}>
          <Plane className="h-3.5 w-3.5" /> Equipment
        </TabButton>
        <TabButton active={tab === "batteries"}   onClick={() => setTab("batteries")}>
          <Battery className="h-3.5 w-3.5" /> Batteries
        </TabButton>
        <TabButton active={tab === "flights"}     onClick={() => setTab("flights")}>
          <ClipboardCheck className="h-3.5 w-3.5" /> Flight Log
        </TabButton>
        <TabButton active={tab === "maintenance"} onClick={() => setTab("maintenance")}>
          <Wrench className="h-3.5 w-3.5" /> Maintenance
        </TabButton>
        <TabButton active={tab === "part107"}     onClick={() => setTab("part107")}>
          <ShieldCheck className="h-3.5 w-3.5" /> Part 107
        </TabButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

        {/* ── EQUIPMENT ── */}
        {tab === "equipment" && (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{drones.length} drone{drones.length !== 1 ? "s" : ""} registered</p>
              <Button variant="gold" size="sm" onClick={() => openDroneDialog()}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Drone
              </Button>
            </div>
            {drones.length === 0 ? (
              <EmptyState icon={Plane} title="No drones yet" desc="Register your first drone to start tracking flights and maintenance."
                action={<Button variant="gold" size="sm" onClick={() => openDroneDialog()}><Plus className="mr-1.5 h-3.5 w-3.5" />Add Drone</Button>} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {drones.map((drone) => {
                  const flightCount = flights.filter((f) => f.drone_id === drone.id).length;
                  const totalMins = flights.filter((f) => f.drone_id === drone.id).reduce((s, f) => s + f.duration_minutes, 0);
                  const hrs = Math.floor(totalMins / 60);
                  const mins = totalMins % 60;
                  return (
                    <div key={drone.id} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d4a853]/10">
                            <Plane className="h-5 w-5 text-[#d4a853]" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{drone.nickname || `${drone.make} ${drone.model}`}</p>
                            {drone.nickname && <p className="text-xs text-muted-foreground">{drone.make} {drone.model}</p>}
                          </div>
                        </div>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", STATUS_BADGE[drone.status])}>
                          {STATUS_LABEL[drone.status]}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        {drone.faa_registration && (
                          <div><span className="text-zinc-500">FAA Reg </span>{drone.faa_registration}</div>
                        )}
                        {drone.serial_number && (
                          <div><span className="text-zinc-500">S/N </span>{drone.serial_number}</div>
                        )}
                        <div><span className="text-zinc-500">Flights </span>{flightCount}</div>
                        <div><span className="text-zinc-500">Air time </span>{hrs > 0 ? `${hrs}h ` : ""}{mins}m</div>
                      </div>
                      <div className="flex items-center gap-2 border-t border-border pt-3">
                        <button onClick={() => openDroneDialog(drone)}
                          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button onClick={() => deleteDrone(drone.id)}
                          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors ml-auto">
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── BATTERIES ── */}
        {tab === "batteries" && (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{batteries.length} batter{batteries.length !== 1 ? "ies" : "y"}</p>
              <Button variant="gold" size="sm" onClick={() => openBatteryDialog()}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Battery
              </Button>
            </div>
            {batteries.length === 0 ? (
              <EmptyState icon={Battery} title="No batteries yet" desc="Add batteries to track charge cycles and know when to replace them."
                action={<Button variant="gold" size="sm" onClick={() => openBatteryDialog()}><Plus className="mr-1.5 h-3.5 w-3.5" />Add Battery</Button>} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {batteries.map((bat) => {
                  const health = batteryHealth(bat.cycle_count);
                  return (
                    <div key={bat.id} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{bat.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {bat.drone ? `${bat.drone.make} ${bat.drone.model}` : "Unassigned"}
                            {bat.capacity_mah ? ` · ${bat.capacity_mah} mAh` : ""}
                          </p>
                        </div>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", health.bg, health.color)}>
                          {health.label}
                        </span>
                      </div>
                      {/* Cycle bar */}
                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Charge cycles</span>
                          <span className={cn("font-semibold tabular-nums", health.color)}>{bat.cycle_count}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted">
                          <div className={cn("h-1.5 rounded-full transition-all", health.bar)} style={{ width: `${health.pct}%` }} />
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground/60">
                          {bat.cycle_count <= 150 ? `${150 - bat.cycle_count} cycles until caution`
                            : bat.cycle_count <= 300 ? `${300 - bat.cycle_count} cycles until replace threshold`
                            : "Past recommended replacement threshold"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 border-t border-border pt-3">
                        <button onClick={() => openBatteryDialog(bat)}
                          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button onClick={() => deleteBattery(bat.id)}
                          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors ml-auto">
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── FLIGHT LOG ── */}
        {tab === "flights" && (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {flights.length} flight{flights.length !== 1 ? "s" : ""} ·{" "}
                {Math.floor(flights.reduce((s, f) => s + f.duration_minutes, 0) / 60)}h{" "}
                {flights.reduce((s, f) => s + f.duration_minutes, 0) % 60}m total air time
              </p>
              <Button variant="gold" size="sm" onClick={() => openFlightDialog()}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Log Flight
              </Button>
            </div>
            {flights.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="No flights logged" desc="Log your first flight to track air time, weather, and pre-flight compliance."
                action={<Button variant="gold" size="sm" onClick={() => openFlightDialog()}><Plus className="mr-1.5 h-3.5 w-3.5" />Log Flight</Button>} />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[90px_1fr_100px_70px_60px_80px_60px_auto] items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
                    {["Date", "Location", "Drone", "Duration", "Alt", "Project", "Pre-flight", ""].map((h, i) => (
                      <div key={i} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</div>
                    ))}
                  </div>
                  {flights.map((f) => (
                    <div key={f.id} className="grid grid-cols-[90px_1fr_100px_70px_60px_80px_60px_auto] items-center gap-3 border-b border-border bg-card px-4 py-3 last:border-0 hover:bg-accent/20 transition-colors">
                      <span className="text-xs tabular-nums text-muted-foreground">{f.flight_date}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{f.location}</p>
                        {f.purpose && <p className="truncate text-[11px] text-muted-foreground">{f.purpose}</p>}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {f.drone ? `${f.drone.make} ${f.drone.model}` : "—"}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {Math.floor(f.duration_minutes / 60) > 0 ? `${Math.floor(f.duration_minutes / 60)}h ` : ""}{f.duration_minutes % 60}m
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {f.max_altitude_ft ? `${f.max_altitude_ft}ft` : "—"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {(f.project as any)?.title ?? "—"}
                      </span>
                      <span className={cn("flex items-center gap-1 text-xs", f.preflight_completed ? "text-emerald-400" : "text-zinc-600")}>
                        {f.preflight_completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openFlightDialog(f)}
                          className="rounded p-1 text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteFlight(f.id)}
                          className="rounded p-1 text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── MAINTENANCE ── */}
        {tab === "maintenance" && (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{maintenance.length} maintenance record{maintenance.length !== 1 ? "s" : ""}</p>
              <Button variant="gold" size="sm" onClick={() => openMaintenanceDialog()} disabled={drones.length === 0}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Log Maintenance
              </Button>
            </div>
            {drones.length === 0 ? (
              <EmptyState icon={Wrench} title="Add a drone first" desc="Register a drone before logging maintenance." />
            ) : maintenance.length === 0 ? (
              <EmptyState icon={Wrench} title="No maintenance records" desc="Keep track of propeller replacements, firmware updates, and repairs."
                action={<Button variant="gold" size="sm" onClick={() => openMaintenanceDialog()}><Plus className="mr-1.5 h-3.5 w-3.5" />Log Maintenance</Button>} />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-[90px_1fr_140px_80px_90px_auto] items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
                    {["Date", "Drone", "Type", "Cost", "Next Service", ""].map((h, i) => (
                      <div key={i} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</div>
                    ))}
                  </div>
                  {maintenance.map((m) => (
                    <div key={m.id} className="grid grid-cols-[90px_1fr_140px_80px_90px_auto] items-center gap-3 border-b border-border bg-card px-4 py-3 last:border-0 hover:bg-accent/20 transition-colors">
                      <span className="text-xs tabular-nums text-muted-foreground">{m.maintenance_date}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {m.drone ? `${m.drone.make} ${m.drone.model}` : "—"}
                        </p>
                        {m.description && <p className="truncate text-[11px] text-muted-foreground">{m.description}</p>}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{m.maintenance_type}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {m.cost_cents ? `$${(m.cost_cents / 100).toFixed(2)}` : "—"}
                      </span>
                      <span className={cn("text-xs tabular-nums", m.next_maintenance_date && new Date(m.next_maintenance_date) < new Date() ? "text-amber-400 font-semibold" : "text-muted-foreground")}>
                        {m.next_maintenance_date ?? "—"}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openMaintenanceDialog(m)}
                          className="rounded p-1 text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteMaintenance(m.id)}
                          className="rounded p-1 text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── PART 107 ── */}
        {tab === "part107" && (
          <div className="max-w-lg">
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d4a853]/10">
                  <ShieldCheck className="h-5 w-5 text-[#d4a853]" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">FAA Part 107 Certificate</p>
                  <p className="text-xs text-muted-foreground">Remote Pilot Certificate — required for commercial drone operations</p>
                </div>
              </div>

              {/* Expiry status */}
              {part107Expires && (() => {
                const days = part107DaysLeft(part107Expires);
                const isExpired = days < 0;
                const isUrgent = days >= 0 && days <= 30;
                const isWarning = days > 30 && days <= 60;
                return (
                  <div className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3",
                    isExpired ? "border-red-500/30 bg-red-500/10" :
                    isUrgent  ? "border-red-500/30 bg-red-500/10" :
                    isWarning ? "border-amber-500/30 bg-amber-500/10" :
                                "border-emerald-500/30 bg-emerald-500/10"
                  )}>
                    <AlertTriangle className={cn("h-4 w-4 shrink-0",
                      isExpired || isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-emerald-400"
                    )} />
                    <p className={cn("text-sm font-medium",
                      isExpired || isUrgent ? "text-red-300" : isWarning ? "text-amber-300" : "text-emerald-300"
                    )}>
                      {isExpired ? `Expired ${Math.abs(days)} days ago — renew immediately`
                        : days === 0 ? "Expires today — renew now"
                        : `${days} days until expiration${isUrgent || isWarning ? " — renew soon" : ""}`}
                    </p>
                  </div>
                );
              })()}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Certificate Number</Label>
                  <Input
                    value={part107Number}
                    onChange={(e) => setPart107Number(e.target.value)}
                    placeholder="e.g. 4207XXX"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Expiration Date</Label>
                  <Input type="date" value={part107Expires} onChange={(e) => setPart107Expires(e.target.value)} />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-zinc-400">Renewal notes</p>
                <p>Part 107 certificates are valid for 24 calendar months. Renew via FAA IACRA at least 30 days before expiration. Recurrent training required every 24 months.</p>
              </div>

              <Button variant="gold" onClick={savePart107} disabled={part107Saving}>
                {part107Saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── DIALOGS ──────────────────────────────────────────────────────── */}

      {/* Add/Edit Drone */}
      <Dialog open={droneOpen} onOpenChange={setDroneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editDrone ? "Edit Drone" : "Add Drone"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Make <span className="text-red-400">*</span></Label>
                <Input value={fMake} onChange={(e) => setFMake(e.target.value)} placeholder="DJI" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Model <span className="text-red-400">*</span></Label>
                <Input value={fModel} onChange={(e) => setFModel(e.target.value)} placeholder="Mavic 3 Pro" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nickname</Label>
              <Input value={fNickname} onChange={(e) => setFNickname(e.target.value)} placeholder="Main rig" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>FAA Registration</Label>
                <Input value={fFaaReg} onChange={(e) => setFFaaReg(e.target.value)} placeholder="FA3XXXXXXX" />
              </div>
              <div className="space-y-1.5">
                <Label>Serial Number</Label>
                <Input value={fSerial} onChange={(e) => setFSerial(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Purchase Date</Label>
                <Input type="date" value={fPurchaseDate} onChange={(e) => setFPurchaseDate(e.target.value)} />
              </div>
              <SelectField label="Status" value={fDroneStatus} onChange={(v) => setFDroneStatus(v as DroneStatus)}>
                <option value="active">Active</option>
                <option value="in_repair">In Repair</option>
                <option value="retired">Retired</option>
              </SelectField>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={fDroneNotes} onChange={(e) => setFDroneNotes(e.target.value)} rows={2} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDroneOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={saveDrone} disabled={saving || !fMake.trim() || !fModel.trim()}>
              {saving ? "Saving…" : editDrone ? "Save Changes" : "Add Drone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Battery */}
      <Dialog open={batteryOpen} onOpenChange={setBatteryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editBattery ? "Edit Battery" : "Add Battery"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Label <span className="text-red-400">*</span></Label>
                <Input value={bLabel} onChange={(e) => setBLabel(e.target.value)} placeholder="Battery 1" autoFocus />
              </div>
              <SelectField label="Drone" value={bDroneId} onChange={setBDroneId}>
                <option value="">Unassigned</option>
                {drones.map((d) => <option key={d.id} value={d.id}>{droneLabel(d)}</option>)}
              </SelectField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Serial Number</Label>
                <Input value={bSerial} onChange={(e) => setBSerial(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label>Capacity (mAh)</Label>
                <Input
                  value={bCapacity}
                  onChange={(e) => setBCapacity(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="5000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Current Cycle Count</Label>
                <Input
                  value={bCycles}
                  onChange={(e) => setBCycles(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Purchase Date</Label>
                <Input type="date" value={bPurchaseDate} onChange={(e) => setBPurchaseDate(e.target.value)} />
              </div>
            </div>
            <SelectField label="Status" value={bBattStatus} onChange={(v) => setBBattStatus(v as DroneBatteryStatus)}>
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </SelectField>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBatteryOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={saveBattery} disabled={saving || !bLabel.trim()}>
              {saving ? "Saving…" : editBattery ? "Save Changes" : "Add Battery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Flight */}
      <Dialog open={flightOpen} onOpenChange={setFlightOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editFlight ? "Edit Flight" : "Log Flight"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">

            {/* Basic info */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Plane className="h-3 w-3" /> Flight Info
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={flDate} onChange={(e) => setFlDate(e.target.value)} />
                </div>
                <SelectField label="Drone" value={flDroneId} onChange={setFlDroneId}>
                  <option value="">No drone selected</option>
                  {drones.map((d) => <option key={d.id} value={d.id}>{droneLabel(d)}</option>)}
                </SelectField>
              </div>
              <div className="space-y-1.5">
                <Label>Location <span className="text-red-400">*</span></Label>
                <Input value={flLocation} onChange={(e) => setFlLocation(e.target.value)} placeholder="City, State or GPS coordinates" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Duration (min) <span className="text-red-400">*</span></Label>
                  <Input
                    value={flDuration}
                    onChange={(e) => setFlDuration(e.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    placeholder="30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Alt (ft)</Label>
                  <Input
                    value={flAltitude}
                    onChange={(e) => setFlAltitude(e.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    placeholder="400"
                  />
                </div>
                <SelectField label="Purpose" value={flPurpose} onChange={setFlPurpose}>
                  <option value="">Select…</option>
                  {DRONE_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </SelectField>
              </div>
            </div>

            {/* Pre-flight checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ClipboardCheck className="h-3 w-3" /> Pre-flight Checklist
                </p>
                <span className={cn("text-xs font-semibold", checklistComplete ? "text-emerald-400" : "text-muted-foreground")}>
                  {checklistCount}/{PREFLIGHT_ITEMS.length} complete
                </span>
              </div>
              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                {PREFLIGHT_ITEMS.map((item) => (
                  <label key={item.key} className="flex cursor-pointer items-start gap-2.5 group">
                    <div className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                      flChecklist[item.key]
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-border bg-background group-hover:border-emerald-500/50"
                    )}>
                      {flChecklist[item.key] && <CheckCircle2 className="h-3 w-3" />}
                    </div>
                    <span className={cn("text-xs leading-relaxed", flChecklist[item.key] ? "text-muted-foreground line-through" : "text-foreground")}>
                      {item.label}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={!!flChecklist[item.key]}
                      onChange={(e) => setFlChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                    />
                  </label>
                ))}
              </div>
              {!checklistComplete && (
                <p className="text-[11px] text-amber-400/80">You can still log the flight without completing the checklist — compliance status will be recorded.</p>
              )}
            </div>

            {/* Weather */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CloudSun className="h-3 w-3" /> Weather Conditions
              </p>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Conditions" value={flWeather} onChange={setFlWeather}>
                  <option value="">Not recorded</option>
                  {WEATHER_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </SelectField>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><Wind className="h-3 w-3" /> Wind (mph)</Label>
                  <Input
                    value={flWind}
                    onChange={(e) => setFlWind(e.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><Eye className="h-3 w-3" /> Visibility (miles)</Label>
                  <Input
                    value={flVisibility}
                    onChange={(e) => setFlVisibility(e.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    placeholder="10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><Thermometer className="h-3 w-3" /> Temperature (°F)</Label>
                  <Input
                    value={flTemp}
                    onChange={(e) => setFlTemp(e.target.value.replace(/[^\d-]/g, ""))}
                    inputMode="numeric"
                    placeholder="72"
                  />
                </div>
              </div>
            </div>

            {/* Batteries used */}
            {batteries.filter((b) => b.status === "active" && (!flDroneId || b.drone_id === flDroneId || !b.drone_id)).length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Battery className="h-3 w-3" /> Batteries Used
                </p>
                <p className="text-[11px] text-muted-foreground">Selecting batteries will auto-increment their cycle count.</p>
                <div className="flex flex-wrap gap-2">
                  {batteries
                    .filter((b) => b.status === "active" && (!flDroneId || b.drone_id === flDroneId || !b.drone_id))
                    .map((b) => {
                      const selected = flBatteries.includes(b.id);
                      const h = batteryHealth(b.cycle_count);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setFlBatteries((prev) => selected ? prev.filter((id) => id !== b.id) : [...prev, b.id])}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                            selected ? "border-[#d4a853]/50 bg-[#d4a853]/10 text-[#d4a853]" : "border-border text-muted-foreground hover:border-[#d4a853]/30"
                          )}
                        >
                          <Battery className="h-3 w-3" />
                          {b.label}
                          <span className={cn("text-[10px]", h.color)}>({b.cycle_count})</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Project + Notes */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FolderKanban className="h-3 w-3" /> Project & Notes
              </p>
              <SelectField label="Link to Project" value={flProjectId} onChange={setFlProjectId}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </SelectField>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={flNotes} onChange={(e) => setFlNotes(e.target.value)} rows={2} placeholder="Shoot notes, conditions, issues…" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFlightOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={saveFlight} disabled={saving || !flLocation.trim() || !flDuration.trim()}>
              {saving ? "Saving…" : editFlight ? "Save Changes" : "Log Flight"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Maintenance */}
      <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editMaintenance ? "Edit Maintenance" : "Log Maintenance"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Drone *" value={mDroneId} onChange={setMDroneId}>
                <option value="">Select drone…</option>
                {drones.map((d) => <option key={d.id} value={d.id}>{droneLabel(d)}</option>)}
              </SelectField>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
              </div>
            </div>
            <SelectField label="Type" value={mType} onChange={setMType}>
              {MAINTENANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </SelectField>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={mDesc} onChange={(e) => setMDesc(e.target.value)} rows={2} placeholder="Details about the work done…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cost ($)</Label>
                <Input
                  value={mCost}
                  onChange={(e) => setMCost(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Next Service Date</Label>
                <Input type="date" value={mNextDate} onChange={(e) => setMNextDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMaintenanceOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={saveMaintenance} disabled={saving || !mDroneId}>
              {saving ? "Saving…" : editMaintenance ? "Save Changes" : "Log Maintenance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
