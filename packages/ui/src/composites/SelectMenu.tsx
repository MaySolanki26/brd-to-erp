import { SelectMenu as TemplateSelectMenu } from '../uab/primitives/SelectMenu';

export type SelectMenuProps = React.ComponentProps<typeof TemplateSelectMenu>;

/** The project's one dropdown (template `SelectMenu`): listbox with type-to-jump, a search box above eight options, check on the selected option. */
export const SelectMenu = TemplateSelectMenu;
