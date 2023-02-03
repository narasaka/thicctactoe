import { cva, VariantProps } from 'class-variance-authority';

const button = cva('rounded-lg px-4 py-2 transition-all duration-200', {
  variants: {
    intent: {
      primary:
        'bg-neutral-800 text-white hover:bg-neutral-700 active:bg-neutral-600',
      secondary:
        'border border-gray-300 bg-neutral-200 text-black hover:bg-neutral-300 active:bg-neutral-400',
    },
    disabled: {
      true: 'cursor-not-allowed',
    },
  },
  compoundVariants: [
    {
      intent: 'primary',
      disabled: true,
      className: 'bg-neutral-800 hover:bg-neutral-800 active:bg-neutral-800',
    },
    {
      intent: 'secondary',
      disabled: true,
      className: 'bg-neutral-200 hover:bg-neutral-200 active:bg-neutral-200',
    },
  ],
  defaultVariants: {
    intent: 'primary',
  },
});
type ButtonProps = VariantProps<typeof button>;

interface Props extends ButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Button: React.FC<Props> = ({
  children,
  onClick,
  disabled,
  intent,
  className,
}) => {
  return (
    <button
      className={button({ intent, disabled, className })}
      disabled={!!disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
