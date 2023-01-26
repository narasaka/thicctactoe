interface ButtonProps {
  children: React.ReactNode;
  secondary?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({
  children,
  secondary,
  disabled,
  onClick,
}) => {
  return (
    <button
      className={`${
        secondary
          ? 'border border-gray-300 bg-neutral-200 text-black hover:bg-neutral-300 active:bg-neutral-400'
          : 'bg-neutral-800 text-white hover:bg-neutral-700 active:bg-neutral-600'
      } ${
        disabled ? 'cursor-not-allowed' : ''
      } rounded-lg px-4 py-2 transition-all duration-200`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
