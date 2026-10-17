import { createContext, useContext } from 'react';
import { colors } from '@/theme/tokens';

/**
 * Which surface a field sits on, so its fill always contrasts with it:
 * on a white card or sheet a field is a blush "well"; on the blush page, or
 * on a tinted block, it is white.
 */
export type FieldTone = 'well' | 'white';
export const FieldToneContext = createContext<FieldTone>('well');
export const useFieldFill = (): string => (useContext(FieldToneContext) === 'white' ? colors.onInkPure : colors.well);

/** True inside a bottom sheet, where the surface is the page colour and fields follow the page rule. */
export const SheetContext = createContext(false);
