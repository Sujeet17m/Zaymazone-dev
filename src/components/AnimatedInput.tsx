import { forwardRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AnimatedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  className?: string;
}

export const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(
  ({ id, label, value, onChange, required, className, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(!!value);

    useEffect(() => {
      setHasValue(!!value);
    }, [value]);

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => {
      setIsFocused(false);
      setHasValue(!!value);
    };

    const isLabelFloating = isFocused || hasValue;

    return (
      <motion.div
        className={cn("relative", className)}
        initial={false}
        animate={{
          scale: isFocused ? 1.01 : 1,
        }}
        transition={{ duration: 0.2 }}
      >
        <Label
          htmlFor={id}
          className={cn(
            "absolute left-3 transition-all duration-200 pointer-events-none z-10 bg-background px-1",
            isLabelFloating
              ? "-top-2.5 text-xs text-primary font-medium"
              : "top-3 text-sm text-muted-foreground"
          )}
        >
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <motion.div
          animate={{
            boxShadow: isFocused ? "0 0 0 2px hsl(var(--primary) / 0.2)" : "none",
          }}
          transition={{ duration: 0.2 }}
          className="rounded-md"
        >
          <Input
            ref={ref}
            id={id}
            value={value}
            onChange={(e) => {
              onChange(e);
              setHasValue(!!e.target.value);
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              "pt-3 pb-3 h-12 transition-all duration-200 border-2",
              isFocused ? "border-primary ring-0" : "border-input",
              isLabelFloating && "pt-3"
            )}
            {...props}
          />
        </motion.div>
      </motion.div>
    );
  }
);

AnimatedInput.displayName = "AnimatedInput";
