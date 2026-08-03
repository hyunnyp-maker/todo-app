/** 앱 이름. 한 곳에서만 정의해 화면마다 어긋나지 않게 한다 */
export const APP_NAME = "Myquence";
export const APP_AUTHOR = "by hyunnyp";

interface Props {
  size?: "sm" | "lg";
  className?: string;
}

export function Brand({ size = "sm", className = "" }: Props) {
  const lg = size === "lg";
  return (
    <span
      className={`inline-flex items-baseline gap-[6px] ${className}`}
      aria-label={`${APP_NAME} ${APP_AUTHOR}`}
    >
      <span
        className={
          lg
            ? "text-[22px] font-bold tracking-[-0.02em]"
            : "text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3"
        }
      >
        {APP_NAME}
      </span>
      <span className={lg ? "text-[11px] text-ink-3" : "text-[9.5px] text-ink-3"}>
        {APP_AUTHOR}
      </span>
    </span>
  );
}
