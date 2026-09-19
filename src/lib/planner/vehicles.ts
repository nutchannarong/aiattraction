import type { FuelKey } from "../fuel";
import type { Vehicle, VehicleType } from "./types";

export type VehicleTypeInfo = {
  key: VehicleType;
  label: string;
  seats: string;
  /** Typical engine size used for the estimate when the user leaves cc empty. */
  defaultCc: number;
  defaultFuel: FuelKey;
  fuels: FuelKey[];
  /** km per unit of fuel for a typical vehicle of this type (petrol/diesel per litre). */
  baseEfficiency: number;
  /** km per kWh for an EV of this type. */
  evEfficiency: number;
  /** Multiplier on car drive time from OSRM (slower vehicles take longer). */
  speedFactor: number;
  /** Thai law bars motorcycles from motorways. */
  avoidMotorway: boolean;
  brands: Record<string, string[]>;
};

export const VEHICLE_TYPES: VehicleTypeInfo[] = [
  {
    key: "motorcycle",
    label: "มอเตอร์ไซค์",
    seats: "1–2 ที่นั่ง",
    defaultCc: 125,
    defaultFuel: "gasohol_95",
    fuels: ["gasohol_91", "gasohol_95", "gasohol_e20", "benzine", "ev"],
    baseEfficiency: 42,
    evEfficiency: 30,
    speedFactor: 1.2,
    avoidMotorway: true,
    brands: {
      Honda: ["Wave 110i", "Click 160", "Scoopy", "PCX160", "ADV160", "Forza 350"],
      Yamaha: ["Fino", "Grand Filano", "NMAX", "Aerox", "XMAX"],
      Suzuki: ["Smash", "Burgman"],
      Kawasaki: ["Ninja 400", "Z900"],
      Vespa: ["Sprint", "Primavera", "GTS"],
      GPX: ["Drone", "Legend"],
    },
  },
  {
    key: "eco_car",
    label: "รถยนต์อีโคคาร์",
    seats: "4–5 ที่นั่ง",
    defaultCc: 1200,
    defaultFuel: "gasohol_91",
    fuels: ["gasohol_91", "gasohol_95", "gasohol_e20", "benzine", "ev"],
    baseEfficiency: 19,
    evEfficiency: 7,
    speedFactor: 1,
    avoidMotorway: false,
    brands: {
      Toyota: ["Yaris", "Yaris Ativ"],
      Honda: ["City", "Brio"],
      Nissan: ["Almera", "March", "Note"],
      Mazda: ["Mazda2"],
      Mitsubishi: ["Mirage", "Attrage"],
      Suzuki: ["Swift", "Celerio"],
      MG: ["MG3", "MG4 Electric"],
      BYD: ["Dolphin", "Atto 2"],
      ORA: ["Good Cat"],
    },
  },
  {
    key: "sedan",
    label: "รถเก๋ง 4–5 ที่นั่ง",
    seats: "4–5 ที่นั่ง",
    defaultCc: 1800,
    defaultFuel: "gasohol_95",
    fuels: ["gasohol_91", "gasohol_95", "gasohol_e20", "benzine", "diesel", "lpg", "ngv", "ev"],
    baseEfficiency: 14,
    evEfficiency: 6.5,
    speedFactor: 1,
    avoidMotorway: false,
    brands: {
      Toyota: ["Corolla Altis", "Camry"],
      Honda: ["Civic", "Accord"],
      Mazda: ["Mazda3"],
      BMW: ["3 Series", "5 Series"],
      "Mercedes-Benz": ["C-Class", "E-Class"],
      BYD: ["Seal"],
      Tesla: ["Model 3"],
    },
  },
  {
    key: "suv",
    label: "SUV 5–7 ที่นั่ง",
    seats: "5–7 ที่นั่ง",
    defaultCc: 2000,
    defaultFuel: "diesel",
    fuels: ["gasohol_91", "gasohol_95", "gasohol_e20", "benzine", "diesel", "lpg", "ev"],
    baseEfficiency: 11.5,
    evEfficiency: 5.8,
    speedFactor: 1,
    avoidMotorway: false,
    brands: {
      Toyota: ["Fortuner", "Corolla Cross", "Veloz"],
      Honda: ["HR-V", "CR-V", "BR-V"],
      Mazda: ["CX-3", "CX-30", "CX-5"],
      Mitsubishi: ["Pajero Sport", "Xpander"],
      Isuzu: ["MU-X"],
      Ford: ["Everest"],
      MG: ["ZS", "HS"],
      BYD: ["Atto 3", "Sealion 6"],
      Haval: ["H6", "Jolion"],
      Nissan: ["Kicks"],
    },
  },
  {
    key: "pickup",
    label: "รถกระบะ",
    seats: "2–5 ที่นั่ง",
    defaultCc: 2400,
    defaultFuel: "diesel",
    fuels: ["diesel", "diesel_b20", "gasohol_91", "lpg", "ngv", "ev"],
    baseEfficiency: 12.5,
    evEfficiency: 4.5,
    speedFactor: 1.05,
    avoidMotorway: false,
    brands: {
      Toyota: ["Hilux Revo", "Hilux Champ"],
      Isuzu: ["D-Max"],
      Ford: ["Ranger"],
      Mitsubishi: ["Triton"],
      Nissan: ["Navara"],
      MG: ["Extender"],
    },
  },
  {
    key: "van",
    label: "รถตู้",
    seats: "9–15 ที่นั่ง",
    defaultCc: 2800,
    defaultFuel: "diesel",
    fuels: ["diesel", "diesel_b20", "lpg", "ngv", "ev"],
    baseEfficiency: 9.5,
    evEfficiency: 4,
    speedFactor: 1.1,
    avoidMotorway: false,
    brands: {
      Toyota: ["Commuter", "Hiace", "Majesty", "Alphard"],
      Hyundai: ["H-1", "Staria"],
      Nissan: ["Urvan"],
      Kia: ["Carnival"],
    },
  },
  {
    key: "bus",
    label: "รถทัวร์ / รถบัส",
    seats: "20–50 ที่นั่ง",
    defaultCc: 7700,
    defaultFuel: "diesel",
    fuels: ["diesel", "diesel_b20", "ngv"],
    baseEfficiency: 3.5,
    evEfficiency: 1.2,
    speedFactor: 1.3,
    avoidMotorway: false,
    brands: {
      Hino: ["RN8J", "RK8J"],
      Isuzu: ["LT134"],
      Scania: ["K360"],
      Volvo: ["B8R"],
      "Mercedes-Benz": ["O500"],
    },
  },
];

export function vehicleTypeInfo(type: VehicleType): VehicleTypeInfo {
  return VEHICLE_TYPES.find((v) => v.key === type) ?? VEHICLE_TYPES[1];
}

/**
 * Estimated distance per unit of fuel (km/L, km/kg for NGV, km/kWh for EV).
 * A rough guide from vehicle type, engine size, age and fuel; users can override it.
 */
export function estimateEfficiency(
  vehicle: Pick<Vehicle, "type" | "cc" | "year" | "fuel">,
  today = new Date(),
) {
  const info = vehicleTypeInfo(vehicle.type);
  if (vehicle.fuel === "ev") return info.evEfficiency;

  let km = info.baseEfficiency;
  const cc = vehicle.cc && vehicle.cc > 0 ? vehicle.cc : info.defaultCc;
  // Bigger engines burn more; keep the adjustment gentle and bounded.
  km *= Math.min(1.3, Math.max(0.7, (info.defaultCc / cc) ** 0.35));

  if (vehicle.year) {
    const age = today.getFullYear() - vehicle.year;
    if (age > 15) km *= 0.88;
    else if (age > 10) km *= 0.93;
  }

  if (vehicle.fuel === "lpg") km *= 0.8;
  if (vehicle.fuel === "ngv") km *= 1.1;
  if (vehicle.fuel === "gasohol_e20") km *= 0.96;

  return Math.round(km * 10) / 10;
}

export function vehicleEfficiency(vehicle: Vehicle) {
  return vehicle.efficiencyOverride && vehicle.efficiencyOverride > 0
    ? vehicle.efficiencyOverride
    : estimateEfficiency(vehicle);
}
