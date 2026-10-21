import {
  Armchair, BedDouble, Building2, Droplets, Fan, Projector, Wifi, Wrench, Zap,
} from 'lucide-react';

const ICONS = {
  zap: Zap,
  droplets: Droplets,
  armchair: Armchair,
  wifi: Wifi,
  projector: Projector,
  bed: BedDouble,
  fan: Fan,
  building: Building2,
};

export const categoryIcon = (name) => ICONS[name] || Wrench;
