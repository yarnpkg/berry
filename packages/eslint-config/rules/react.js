import arcaEslint  from 'eslint-plugin-arca';
import reactEslint from 'eslint-plugin-react';

// eslint-disable-next-line arca/no-default-export
export default [
  {
    plugins: {
      [`arca`]: arcaEslint,
      [`react`]: reactEslint,
    },

    rules: {
      'arca/jsx-longhand-props': 2,
      'react/jsx-uses-react': 1,
      'react/jsx-uses-vars': 1,
    },
  },
];
