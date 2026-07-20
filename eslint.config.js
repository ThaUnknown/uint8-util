import config from 'eslint-config-standard-universal'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...config({ ...globals.node, ...globals.browser, NodeJS: false }),
  {
    ignores: ['benchmark/**']
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js']
        },
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
)
