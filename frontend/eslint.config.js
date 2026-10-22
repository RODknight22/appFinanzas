// Linter de TypeScript/React: `npm run lint` (lo ejecutan scripts/verificar.sh y el CI).
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    files: ["**/*.{ts,tsx}"],
    // Reglas recomendadas: errores reales (variables sin usar, código inalcanzable...).
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Las reglas de los hooks: llamarlos siempre en el mismo orden y no olvidar dependencias.
      ...reactHooks.configs.recommended.rules,
    },
  },
);
