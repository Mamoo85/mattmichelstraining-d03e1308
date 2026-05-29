export interface LiftConfig {
  name: string;
  repMax: number; // 1, 3, or 5
  muscles: string[]; // muscle group keys for avatar
}

export interface LiftCategory {
  label: string;
  lifts: LiftConfig[];
}

export const LIFT_CATEGORIES: LiftCategory[] = [
  {
    label: "3-Rep Max",
    lifts: [
      { name: "Squat", repMax: 3, muscles: ["quads", "glutes", "core", "lowerBack"] },
      { name: "Front Squat", repMax: 3, muscles: ["quads", "core", "upperBack", "shoulders"] },
      { name: "Box Squat", repMax: 3, muscles: ["quads", "glutes", "hamstrings", "lowerBack"] },
      { name: "Bench Press", repMax: 3, muscles: ["chest", "triceps", "shoulders"] },
      { name: "Floor Press", repMax: 3, muscles: ["chest", "triceps", "shoulders"] },
      { name: "Overhead Press", repMax: 3, muscles: ["shoulders", "triceps", "core", "upperBack"] },
    ],
  },
  {
    label: "5-Rep Max",
    lifts: [
      { name: "Deadlift", repMax: 5, muscles: ["hamstrings", "glutes", "lowerBack", "upperBack", "forearms"] },
      { name: "Sumo Deadlift", repMax: 5, muscles: ["quads", "glutes", "hamstrings", "lowerBack", "forearms"] },
      { name: "Hex Bar Deadlift", repMax: 5, muscles: ["quads", "glutes", "hamstrings", "upperBack", "forearms"] },
    ],
  },
  {
    label: "Advanced · Olympic",
    lifts: [
      { name: "Power Clean", repMax: 1, muscles: ["quads", "glutes", "hamstrings", "upperBack", "shoulders", "forearms"] },
      { name: "Hang Clean", repMax: 1, muscles: ["quads", "glutes", "hamstrings", "upperBack", "shoulders", "forearms"] },
    ],
  },
];

export const ALL_LIFTS = LIFT_CATEGORIES.flatMap((c) => c.lifts);

export const getLiftConfig = (name: string): LiftConfig | undefined =>
  ALL_LIFTS.find((l) => l.name === name);
