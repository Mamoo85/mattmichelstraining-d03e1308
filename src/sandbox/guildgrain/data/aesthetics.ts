import nonna from "../assets/aesthetic-nonna.jpg";
import celestial from "../assets/aesthetic-celestial.jpg";
import retro from "../assets/aesthetic-retro.jpg";

export interface Aesthetic {
  id: string;
  label: string;
  blurb: string;
  image: string;
}

export const AESTHETICS: Aesthetic[] = [
  { id: "nonna", label: "Nonna's Kitchen Red", blurb: "Warm gingham, copper, old-world Italian", image: nonna },
  { id: "celestial", label: "Moody Celestial", blurb: "Deep navy, brass moons, candlelight", image: celestial },
  { id: "retro", label: "Play Haus Retro", blurb: "Mustard, checkers, mid-century joy", image: retro },
];
