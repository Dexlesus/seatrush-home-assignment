import { SvgIcon, type SvgIconProps } from '@mui/material';

/**
 * The few line icons the app uses, drawn inline (no icon library to install).
 * Same 24×24 stroke style as lucide.
 */
function line(paths: string[], name: string) {
  function Icon(props: SvgIconProps) {
    return (
      <SvgIcon
        {...props}
        viewBox="0 0 24 24"
        sx={{
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          ...props.sx,
        }}
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </SvgIcon>
    );
  }
  Icon.displayName = name;
  return Icon;
}

export const MapPinIcon = line(
  ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  'MapPinIcon',
);
export const CalendarIcon = line(
  ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z'],
  'CalendarIcon',
);
export const ClockIcon = line(['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 6v6l4 2'], 'ClockIcon');
export const TicketIcon = line(
  [
    'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z',
    'M13 5v2',
    'M13 17v2',
    'M13 11v2',
  ],
  'TicketIcon',
);
export const UsersIcon = line(
  [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  'UsersIcon',
);
export const SparklesIcon = line(
  [
    'M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0Z',
  ],
  'SparklesIcon',
);
export const StarIcon = line(
  ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z'],
  'StarIcon',
);
export const EyeIcon = line(
  ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  'EyeIcon',
);
export const XIcon = line(['M18 6 6 18', 'M6 6l12 12'], 'XIcon');
export const CheckIcon = line(['M20 6 9 17l-5-5'], 'CheckIcon');
export const ArmchairIcon = line(
  [
    'M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3',
    'M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0Z',
    'M5 18v2',
    'M19 18v2',
  ],
  'ArmchairIcon',
);
export const InfoIcon = line(
  ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 16v-4', 'M12 8h.01'],
  'InfoIcon',
);
