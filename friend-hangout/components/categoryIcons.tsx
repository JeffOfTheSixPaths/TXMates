import {
  Coffee,
  Gamepad2,
  Music,
  Palette,
  TreePine,
  Trophy,
  Utensils,
  Wine,
  type LucideIcon,
} from "lucide-react";
import type { ActivityCategory } from "@/types";

export const CATEGORY_ICONS: Record<ActivityCategory, LucideIcon> = {
  food: Utensils,
  music: Music,
  outdoors: TreePine,
  gaming: Gamepad2,
  sports: Trophy,
  nightlife: Wine,
  arts: Palette,
  chill: Coffee,
};
