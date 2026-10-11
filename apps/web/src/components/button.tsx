import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

export const buttonClass = cva(
  "rounded-lg px-4 py-2 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      intent: {
        primary:
          "bg-neutral-800 text-white hover:bg-neutral-700 active:bg-neutral-600 disabled:hover:bg-neutral-800",
        secondary:
          "border border-gray-300 bg-neutral-200 text-black hover:bg-neutral-300 active:bg-neutral-400 disabled:hover:bg-neutral-200",
      },
    },
    defaultVariants: {
      intent: "primary",
    },
  },
);

type Props = ComponentProps<"button"> & VariantProps<typeof buttonClass>;

export default function Button({ intent, className, type = "button", ...props }: Props) {
  return <button type={type} className={buttonClass({ intent, className })} {...props} />;
}
