/**
 * The mobile component kit. Screens in `src/mobile/**` import from here and
 * nowhere else for presentation primitives.
 *
 * Deliberately separate from `src/components/ui/`, which belongs to the desktop
 * tree and stays byte-identical (the "不要为 Android 破坏桌面" red line). Nothing
 * in this directory is imported by any desktop file — `tests/desktopIsolation`
 * style checks aside, the guarantee is that `src/components/ui-kit` is new
 * surface on the `mobile-ui-rewrite` branch only.
 */
export { Button, buttonVariants, type ButtonProps } from "./Button";
export {
  ListItem,
  ListItemLeading,
  ListItemMain,
  ListItemSubtitle,
  ListItemTitle,
  ListItemTrailing,
  listItemVariants,
  type ListItemProps,
} from "./ListItem";
export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./Sheet";
export { Switch } from "./Switch";
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";