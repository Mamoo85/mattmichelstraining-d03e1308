// @ts-nocheck
/**
 * STL Generators — shared module for 3D printable digital product STL generation.
 * Uses @jscad/modeling and @jscad/stl-serializer to produce binary STL files.
 * Uses fflate for ZIP packaging.
 *
 * IMPORTANT: serialize() returns MULTIPLE ArrayBuffer chunks — must concatenate.
 */

import * as modeling from "npm:@jscad/modeling@2.13.0";
import { serialize } from "npm:@jscad/stl-serializer@2.1.23";
import { zipSync } from "npm:fflate@0.8.2";

const { primitives, booleans, transforms, extrusions } = modeling;
const { cylinder, cuboid, polygon } = primitives;
const { subtract, union } = booleans;
const { translate, rotateX, rotateY, rotateZ } = transforms;
const { extrudeLinear } = extrusions;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function circlePoints(r: number, n = 48): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

function starPoints(outerR: number, innerR: number, pts = 5): [number, number][] {
  const result: [number, number][] = [];
  const totalPts = pts * 2;
  for (let i = 0; i < totalPts; i++) {
    const angle = (Math.PI * i) / pts - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    result.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  return result;
}

function hexPoints(r: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

function heartPoints(scale = 1.0): [number, number][] {
  const pts: [number, number][] = [];
  const steps = 64;
  for (let i = 0; i < steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    // Parametric heart: x = 16sin³t, y = 13cos - 5cos2 - 2cos3 - cos4
    const x = scale * 16 * Math.pow(Math.sin(t), 3);
    const y =
      scale *
      (13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t));
    pts.push([x, y]);
  }
  return pts;
}

function shrinkPolygon(pts: [number, number][], mm: number): [number, number][] {
  // Find centroid
  let cx = 0;
  let cy = 0;
  for (const [x, y] of pts) {
    cx += x;
    cy += y;
  }
  cx /= pts.length;
  cy /= pts.length;

  return pts.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return [x, y];
    const factor = Math.max(0, (len - mm) / len);
    return [cx + dx * factor, cy + dy * factor];
  });
}

/**
 * Cookie cutter: outer wall extruded, inner void subtracted, handle added on top.
 */
function cookieCutter(
  outerPts: [number, number][],
  heightMm = 20,
  wallMm = 2
): any {
  const outer = extrudeLinear({ height: heightMm }, polygon({ points: outerPts }));
  const innerPts = shrinkPolygon(outerPts, wallMm);
  const inner = extrudeLinear(
    { height: heightMm - 2 },
    polygon({ points: innerPts })
  );
  const shell = subtract(outer, inner);

  // Handle: a rectangular bar across the top center
  const handle = cuboid({ size: [20, 6, 4] });
  const handlePos = translate([0, 0, heightMm + 2], handle);

  return union(shell, handlePos);
}

// ---------------------------------------------------------------------------
// Template metadata
// ---------------------------------------------------------------------------

export const STL_TEMPLATE_IDS: string[] = [
  "cookie-round",
  "cookie-star-5pt",
  "cookie-star-8pt",
  "cookie-hexagon",
  "cookie-heart",
  "wall-hook-small",
  "wall-hook-medium",
  "wall-hook-large",
  "cable-clip-2mm",
  "cable-clip-5mm",
  "cable-clip-10mm",
  "phone-stand",
  "pen-holder",
  "card-holder",
  "soap-dish",
  "drawer-divider-s",
  "drawer-divider-l",
  "dice-tray",
  "key-rack",
  "plant-drain",
];

export interface StlTemplateMeta {
  title: string;
  description: string;
  category: string;
  tags: string[]; // exactly 13
  price_cents: number;
  filename_prefix: string;
}

export const STL_TEMPLATE_META: Record<string, StlTemplateMeta> = {
  "cookie-round": {
    title: "Round Cookie Cutter 50mm | STL File for 3D Printing",
    description:
      "Printable 50mm round cookie cutter. Clean 2mm wall, integrated handle. Print in PLA at 0.2mm layer height.",
    category: "cookie_cutter",
    tags: [
      "cookie cutter",
      "round cutter",
      "3d printable",
      "stl file",
      "baking tool",
      "fondant cutter",
      "clay cutter",
      "kitchen tool",
      "diy baking",
      "custom cookie",
      "pastry tool",
      "biscuit cutter",
      "food safe stl",
    ],
    price_cents: 349,
    filename_prefix: "round-cookie-cutter",
  },
  "cookie-star-5pt": {
    title: "5-Point Star Cookie Cutter | STL File for 3D Printing",
    description:
      "Printable 5-point star cookie cutter, 56mm tip-to-tip. Clean 2mm wall, integrated handle. Perfect for PLA at 0.2mm.",
    category: "cookie_cutter",
    tags: [
      "star cookie cutter",
      "5 point star",
      "3d printable",
      "stl file",
      "baking tool",
      "fondant cutter",
      "clay cutter",
      "kitchen tool",
      "holiday baking",
      "custom cookie",
      "star shape",
      "biscuit cutter",
      "food safe stl",
    ],
    price_cents: 349,
    filename_prefix: "star-5pt-cookie-cutter",
  },
  "cookie-star-8pt": {
    title: "8-Point Star Cookie Cutter | STL File for 3D Printing",
    description:
      "Printable 8-point star cookie cutter, 56mm tip-to-tip. Clean 2mm wall, integrated handle. Great for PLA at 0.2mm.",
    category: "cookie_cutter",
    tags: [
      "star cookie cutter",
      "8 point star",
      "3d printable",
      "stl file",
      "baking tool",
      "fondant cutter",
      "clay cutter",
      "kitchen tool",
      "christmas star",
      "custom cookie",
      "starburst shape",
      "biscuit cutter",
      "food safe stl",
    ],
    price_cents: 349,
    filename_prefix: "star-8pt-cookie-cutter",
  },
  "cookie-hexagon": {
    title: "Hexagon Cookie Cutter 56mm | STL File for 3D Printing",
    description:
      "Printable hexagon cookie cutter. Perfect for honeycomb patterns. 2mm wall, integrated handle. Print in PLA.",
    category: "cookie_cutter",
    tags: [
      "hexagon cookie cutter",
      "hex cutter",
      "3d printable",
      "stl file",
      "baking tool",
      "fondant cutter",
      "honeycomb cookie",
      "kitchen tool",
      "geometric cutter",
      "custom cookie",
      "bee theme",
      "biscuit cutter",
      "food safe stl",
    ],
    price_cents: 349,
    filename_prefix: "hexagon-cookie-cutter",
  },
  "cookie-heart": {
    title: "Heart Cookie Cutter | STL File for 3D Printing",
    description:
      "Printable heart-shaped cookie cutter with parametric heart formula for a perfect curve. 2mm wall, integrated handle.",
    category: "cookie_cutter",
    tags: [
      "heart cookie cutter",
      "heart cutter",
      "3d printable",
      "stl file",
      "valentines baking",
      "fondant cutter",
      "clay cutter",
      "kitchen tool",
      "heart shaped",
      "custom cookie",
      "love cookie",
      "biscuit cutter",
      "food safe stl",
    ],
    price_cents: 349,
    filename_prefix: "heart-cookie-cutter",
  },
  "wall-hook-small": {
    title: "Small Wall Hook 30mm | STL File for 3D Printing",
    description:
      "Compact 30mm projection wall hook with mounting plate. Print in PLA or PETG. Supports up to 2kg.",
    category: "wall_hook",
    tags: [
      "wall hook",
      "small hook",
      "3d printable",
      "stl file",
      "home organizer",
      "coat hook",
      "key hook",
      "bathroom hook",
      "entryway storage",
      "printable hook",
      "wall mount",
      "diy home",
      "pla hook",
    ],
    price_cents: 299,
    filename_prefix: "wall-hook-small",
  },
  "wall-hook-medium": {
    title: "Medium Wall Hook 50mm | STL File for 3D Printing",
    description:
      "50mm projection wall hook with reinforced mounting plate. Print in PLA or PETG. Great for bags and coats.",
    category: "wall_hook",
    tags: [
      "wall hook",
      "medium hook",
      "3d printable",
      "stl file",
      "home organizer",
      "coat hook",
      "bag hook",
      "bathroom hook",
      "entryway storage",
      "printable hook",
      "wall mount",
      "diy home",
      "pla hook",
    ],
    price_cents: 299,
    filename_prefix: "wall-hook-medium",
  },
  "wall-hook-large": {
    title: "Large Wall Hook 70mm | STL File for 3D Printing",
    description:
      "70mm projection wall hook for heavy items. Reinforced base with dual screw holes. Print in PETG for best strength.",
    category: "wall_hook",
    tags: [
      "wall hook",
      "large hook",
      "3d printable",
      "stl file",
      "heavy duty hook",
      "coat hook",
      "bike hook",
      "garage storage",
      "entryway storage",
      "printable hook",
      "wall mount",
      "diy garage",
      "petg hook",
    ],
    price_cents: 299,
    filename_prefix: "wall-hook-large",
  },
  "cable-clip-2mm": {
    title: "Cable Clip 2mm (Earbuds) | STL File for 3D Printing",
    description:
      "Snap-on desk cable clip for 2mm cables like earbuds and thin charging wires. Print in flexible TPU or PLA.",
    category: "cable_management",
    tags: [
      "cable clip",
      "earbud holder",
      "3d printable",
      "stl file",
      "desk organizer",
      "cable management",
      "wire holder",
      "cable keeper",
      "cord organizer",
      "desk tidy",
      "office tool",
      "tpu print",
      "cable organizer",
    ],
    price_cents: 199,
    filename_prefix: "cable-clip-2mm",
  },
  "cable-clip-5mm": {
    title: "Cable Clip 5mm (USB) | STL File for 3D Printing",
    description:
      "Snap-on desk cable clip for 5mm cables like USB-C and standard charging cables. Print in TPU or PLA.",
    category: "cable_management",
    tags: [
      "cable clip",
      "usb cable holder",
      "3d printable",
      "stl file",
      "desk organizer",
      "cable management",
      "wire holder",
      "cable keeper",
      "cord organizer",
      "desk tidy",
      "office tool",
      "tpu print",
      "cable organizer",
    ],
    price_cents: 199,
    filename_prefix: "cable-clip-5mm",
  },
  "cable-clip-10mm": {
    title: "Cable Clip 10mm (Power Cord) | STL File for 3D Printing",
    description:
      "Heavy-duty snap-on cable clip for 10mm power cords. Keeps desktop and workstation cables tidy. Print in PETG.",
    category: "cable_management",
    tags: [
      "cable clip",
      "power cord holder",
      "3d printable",
      "stl file",
      "desk organizer",
      "cable management",
      "wire holder",
      "cable keeper",
      "cord organizer",
      "workstation tidy",
      "office tool",
      "petg print",
      "cable organizer",
    ],
    price_cents: 199,
    filename_prefix: "cable-clip-10mm",
  },
  "phone-stand": {
    title: "Phone Stand Portrait | STL File for 3D Printing",
    description:
      "Angled portrait phone stand with cable slot. Works with most phones up to 80mm wide. Print in PLA at 0.2mm.",
    category: "phone_stand",
    tags: [
      "phone stand",
      "phone holder",
      "3d printable",
      "stl file",
      "desk accessory",
      "iphone stand",
      "android stand",
      "portrait stand",
      "cable slot stand",
      "desk organizer",
      "phone dock",
      "bedside stand",
      "pla stand",
    ],
    price_cents: 349,
    filename_prefix: "phone-stand-portrait",
  },
  "pen-holder": {
    title: "Hexagonal Pen Holder | STL File for 3D Printing",
    description:
      "Geometric hexagonal pen and pencil holder for desk organization. Holds 12+ pens. Print in PLA at 0.2mm.",
    category: "desk_organizer",
    tags: [
      "pen holder",
      "pencil holder",
      "3d printable",
      "stl file",
      "desk organizer",
      "hexagon holder",
      "office storage",
      "desk tidy",
      "stationery holder",
      "geometric decor",
      "desk accessory",
      "pla print",
      "pencil cup",
    ],
    price_cents: 349,
    filename_prefix: "hex-pen-holder",
  },
  "card-holder": {
    title: "Business Card Display Holder | STL File for 3D Printing",
    description:
      "Clean angled business card display stand. Holds a full stack of standard cards. Print in PLA for professional finish.",
    category: "desk_organizer",
    tags: [
      "card holder",
      "business card stand",
      "3d printable",
      "stl file",
      "desk organizer",
      "card display",
      "office accessory",
      "desk stand",
      "card rack",
      "name card holder",
      "reception desk",
      "professional decor",
      "pla print",
    ],
    price_cents: 299,
    filename_prefix: "business-card-holder",
  },
  "soap-dish": {
    title: "Soap Dish with Drainage Grid | STL File for 3D Printing",
    description:
      "Bar soap dish with integrated drainage grid to keep soap dry. Print in PETG for water resistance.",
    category: "bathroom",
    tags: [
      "soap dish",
      "soap holder",
      "3d printable",
      "stl file",
      "bathroom accessory",
      "drainage soap dish",
      "bar soap holder",
      "shower caddy",
      "sink organizer",
      "petg print",
      "bathroom decor",
      "eco friendly",
      "soap tray",
    ],
    price_cents: 349,
    filename_prefix: "soap-dish-drain",
  },
  "drawer-divider-s": {
    title: "Drawer Divider 150mm | STL File for 3D Printing",
    description:
      "Snap-fit drawer divider, 150mm wide. Keeps utensils and supplies separated. Print in PLA at 0.3mm for speed.",
    category: "organizer",
    tags: [
      "drawer divider",
      "drawer organizer",
      "3d printable",
      "stl file",
      "kitchen organizer",
      "desk drawer",
      "utensil organizer",
      "storage divider",
      "snap fit",
      "home organizer",
      "diy storage",
      "pla print",
      "drawer insert",
    ],
    price_cents: 299,
    filename_prefix: "drawer-divider-150",
  },
  "drawer-divider-l": {
    title: "Drawer Divider 250mm | STL File for 3D Printing",
    description:
      "Snap-fit drawer divider, 250mm wide for larger drawers. Keeps items organized. Print in PLA at 0.3mm for speed.",
    category: "organizer",
    tags: [
      "drawer divider",
      "drawer organizer",
      "3d printable",
      "stl file",
      "kitchen organizer",
      "desk drawer",
      "utensil organizer",
      "storage divider",
      "snap fit",
      "home organizer",
      "large divider",
      "pla print",
      "drawer insert",
    ],
    price_cents: 299,
    filename_prefix: "drawer-divider-250",
  },
  "dice-tray": {
    title: "Hexagonal Dice Tray | STL File for 3D Printing",
    description:
      "Geometric hex dice tray with raised walls to keep dice contained. Great for tabletop RPGs. Print in PLA.",
    category: "gaming",
    tags: [
      "dice tray",
      "hex dice tray",
      "3d printable",
      "stl file",
      "tabletop rpg",
      "dnd accessory",
      "game tray",
      "dice holder",
      "board game",
      "rpg gift",
      "dungeon master",
      "hex tray",
      "pla print",
    ],
    price_cents: 399,
    filename_prefix: "hex-dice-tray",
  },
  "key-rack": {
    title: "4-Peg Key Rack with Mounting Holes | STL File for 3D Printing",
    description:
      "Wall-mounted key rack with 4 pegs and pre-drilled mounting holes. Keep keys organized at the door. Print in PLA.",
    category: "home_organizer",
    tags: [
      "key rack",
      "key holder",
      "3d printable",
      "stl file",
      "wall organizer",
      "entryway storage",
      "key hook",
      "key wall mount",
      "home organizer",
      "door organizer",
      "housewarming gift",
      "pla print",
      "key storage",
    ],
    price_cents: 349,
    filename_prefix: "key-rack-4peg",
  },
  "plant-drain": {
    title: "Plant Pot Drainage Insert Ring | STL File for 3D Printing",
    description:
      "Raised drainage ring insert for plant pots. Lifts soil off standing water. Print in PETG for moisture resistance.",
    category: "garden",
    tags: [
      "plant pot insert",
      "drainage ring",
      "3d printable",
      "stl file",
      "plant accessory",
      "pot drainage",
      "indoor plant",
      "succulent pot",
      "garden tool",
      "petg print",
      "plant care",
      "root rot prevention",
      "planter insert",
    ],
    price_cents: 249,
    filename_prefix: "plant-drain-ring",
  },
};

// ---------------------------------------------------------------------------
// Geometry builders (one per template)
// ---------------------------------------------------------------------------

function buildGeometry(templateId: string): any {
  switch (templateId) {
    case "cookie-round":
      return cookieCutter(circlePoints(25, 48));

    case "cookie-star-5pt":
      return cookieCutter(starPoints(28, 12, 5));

    case "cookie-star-8pt":
      return cookieCutter(starPoints(28, 16, 8));

    case "cookie-hexagon":
      return cookieCutter(hexPoints(28));

    case "cookie-heart":
      return cookieCutter(heartPoints(1.7));

    case "wall-hook-small": {
      // Mounting plate + arm + hook tip
      const plate = cuboid({ size: [40, 8, 50] });
      const arm = cuboid({ size: [30, 8, 8] });
      const armPos = translate([15, 0, -21], arm);
      const tip = cuboid({ size: [8, 8, 12] });
      const tipPos = translate([30, 0, -15], tip);
      return union(plate, armPos, tipPos);
    }

    case "wall-hook-medium": {
      const plate = cuboid({ size: [50, 8, 60] });
      const arm = cuboid({ size: [50, 8, 8] });
      const armPos = translate([25, 0, -26], arm);
      const tip = cuboid({ size: [8, 8, 14] });
      const tipPos = translate([50, 0, -19], tip);
      return union(plate, armPos, tipPos);
    }

    case "wall-hook-large": {
      const plate = cuboid({ size: [60, 10, 70] });
      const arm = cuboid({ size: [70, 10, 10] });
      const armPos = translate([35, 0, -30], arm);
      const tip = cuboid({ size: [10, 10, 18] });
      const tipPos = translate([70, 0, -22], tip);
      return union(plate, armPos, tipPos);
    }

    case "cable-clip-2mm": {
      // Base clip body with small channel
      const body = cuboid({ size: [20, 14, 8] });
      const channel = cylinder({ radius: 1.5, height: 22, segments: 16 });
      const channelPos = translate([0, 0, 0], rotateX(Math.PI / 2, channel));
      return subtract(body, channelPos);
    }

    case "cable-clip-5mm": {
      const body = cuboid({ size: [24, 16, 10] });
      const channel = cylinder({ radius: 3, height: 26, segments: 16 });
      const channelPos = rotateX(Math.PI / 2, channel);
      return subtract(body, channelPos);
    }

    case "cable-clip-10mm": {
      const body = cuboid({ size: [30, 20, 14] });
      const channel = cylinder({ radius: 5.5, height: 32, segments: 16 });
      const channelPos = rotateX(Math.PI / 2, channel);
      return subtract(body, channelPos);
    }

    case "phone-stand": {
      // Angled wedge base + back support + phone slot
      const base = cuboid({ size: [80, 60, 6] });
      const backSupport = cuboid({ size: [80, 6, 50] });
      const backPos = translate([0, -27, 28], backSupport);
      const ledge = cuboid({ size: [80, 10, 4] });
      const ledgePos = translate([0, -17, 4], ledge);
      return union(base, backPos, ledgePos);
    }

    case "pen-holder": {
      // Hexagonal outer wall, hollow inside
      const outerHex = extrudeLinear(
        { height: 100 },
        polygon({ points: hexPoints(40) })
      );
      const innerHex = extrudeLinear(
        { height: 98 },
        polygon({ points: hexPoints(37) })
      );
      const innerPos = translate([0, 0, 2], innerHex);
      return subtract(outerHex, innerPos);
    }

    case "card-holder": {
      // Angled ramp with back stop and side walls
      const base = cuboid({ size: [95, 65, 4] });
      const backWall = cuboid({ size: [95, 4, 30] });
      const backWallPos = translate([0, -30.5, 17], backWall);
      const leftWall = cuboid({ size: [4, 65, 20] });
      const leftWallPos = translate([-45.5, 0, 12], leftWall);
      const rightWall = cuboid({ size: [4, 65, 20] });
      const rightWallPos = translate([45.5, 0, 12], rightWall);
      return union(base, backWallPos, leftWallPos, rightWallPos);
    }

    case "soap-dish": {
      // Rectangular dish with drainage grid
      const outerBox = cuboid({ size: [110, 80, 20] });
      const innerVoid = cuboid({ size: [104, 74, 18] });
      const innerPos = translate([0, 0, 2], innerVoid);
      const shell = subtract(outerBox, innerPos);
      // Grid bars (5 cross bars)
      const gridParts = [shell];
      for (let i = -2; i <= 2; i++) {
        const bar = cuboid({ size: [108, 4, 4] });
        gridParts.push(translate([0, i * 14, 4], bar));
      }
      return union(...gridParts);
    }

    case "drawer-divider-s": {
      // 150mm wide divider panel with snap tabs
      const panel = cuboid({ size: [150, 4, 50] });
      const tabLeft = cuboid({ size: [8, 10, 8] });
      const tabRight = cuboid({ size: [8, 10, 8] });
      const tabLeftPos = translate([-71, 3, -21], tabLeft);
      const tabRightPos = translate([71, 3, -21], tabRight);
      return union(panel, tabLeftPos, tabRightPos);
    }

    case "drawer-divider-l": {
      // 250mm wide divider panel with snap tabs
      const panel = cuboid({ size: [250, 4, 50] });
      const tabLeft = cuboid({ size: [8, 10, 8] });
      const tabRight = cuboid({ size: [8, 10, 8] });
      const tabLeftPos = translate([-121, 3, -21], tabLeft);
      const tabRightPos = translate([121, 3, -21], tabRight);
      return union(panel, tabLeftPos, tabRightPos);
    }

    case "dice-tray": {
      // Hex outer wall, hollow, with floor
      const outerHex = extrudeLinear(
        { height: 30 },
        polygon({ points: hexPoints(80) })
      );
      const innerHex = extrudeLinear(
        { height: 28 },
        polygon({ points: hexPoints(76) })
      );
      const innerPos = translate([0, 0, 2], innerHex);
      return subtract(outerHex, innerPos);
    }

    case "key-rack": {
      // Back plate with 4 pegs and 2 mounting holes
      const backPlate = cuboid({ size: [200, 8, 50] });
      // 4 pegs evenly spaced
      const pegPositions = [-75, -25, 25, 75];
      const pegs = pegPositions.map((x) => {
        const peg = cylinder({ radius: 5, height: 30, segments: 16 });
        return translate([x, -19, 5], rotateX(Math.PI / 2, peg));
      });
      // 2 mounting holes (via subtract on back plate)
      const hole1 = cylinder({ radius: 3, height: 10, segments: 16 });
      const hole2 = cylinder({ radius: 3, height: 10, segments: 16 });
      const h1Pos = translate([-90, 0, 0], rotateX(Math.PI / 2, hole1));
      const h2Pos = translate([90, 0, 0], rotateX(Math.PI / 2, hole2));
      const plateWithHoles = subtract(backPlate, h1Pos, h2Pos);
      return union(plateWithHoles, ...pegs);
    }

    case "plant-drain": {
      // Ring shape: outer cylinder minus inner cylinder, with radial ribs
      const outerRing = cylinder({ radius: 70, height: 15, segments: 48 });
      const innerVoid = cylinder({ radius: 62, height: 17, segments: 48 });
      const ring = subtract(outerRing, innerVoid);
      // 8 drainage ribs across the base
      const ribParts = [ring];
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const rib = cuboid({ size: [130, 4, 6] });
        const ribPos = translate([0, 0, -4.5], rotateZ(angle, rib));
        ribParts.push(ribPos);
      }
      return union(...ribParts);
    }

    default:
      throw new Error(`Unknown template ID: ${templateId}`);
  }
}

// ---------------------------------------------------------------------------
// STL serialization helper (handles multi-chunk output)
// ---------------------------------------------------------------------------

function serializeToUint8Array(geo: any): Uint8Array {
  const chunks: ArrayBuffer[] = serialize({ binary: true }, geo);
  const total = chunks.reduce((s, c) => s + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(new Uint8Array(c), off);
    off += c.byteLength;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate binary STL bytes for a given template ID.
 */
export function generateStl(templateId: string): Uint8Array {
  const geo = buildGeometry(templateId);
  return serializeToUint8Array(geo);
}

/**
 * Build a ZIP file containing STL files for the requested template IDs.
 * Returns the ZIP as a Uint8Array.
 */
export function buildStlZip(templateIds: string[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const id of templateIds) {
    const stlBytes = generateStl(id);
    files[`${id}.stl`] = stlBytes;
  }
  return zipSync(files);
}
