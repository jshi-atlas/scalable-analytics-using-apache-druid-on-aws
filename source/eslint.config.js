/* 
 Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 SPDX-License-Identifier: Apache-2.0
*/
const path = require('path');
const js = require('@eslint/js');
const globals = require('globals');
const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');
const licenseHeader = require('eslint-plugin-license-header');

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'cdk.out/**',
            '**/target/**',
            '**/*.js',
            '**/*.cjs',
            '**/*.mjs',
            '**/*.jsx',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig,
    {
        files: ['**/*.ts'],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
            parser: tseslint.parser,
            parserOptions: {
                project: ['./tsconfig.json'],
                tsconfigRootDir: __dirname,
            },
            globals: {
                ...globals.node,
                ...globals.es2020,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            prettier: prettierPlugin,
            'license-header': licenseHeader,
        },
        rules: {
            'license-header/header': [
                'error',
                path.join(__dirname, 'LicenseHeader.txt'),
            ],
            'prettier/prettier': 'error',

            '@typescript-eslint/array-type': ['warn'],
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/class-literal-property-style': ['warn'],
            '@typescript-eslint/consistent-indexed-object-style': ['error', 'record'],
            '@typescript-eslint/explicit-function-return-type': ['error'],
            '@typescript-eslint/explicit-member-accessibility': ['warn'],
            '@typescript-eslint/naming-convention': [
                'error',
                { selector: 'variableLike', format: ['camelCase'], leadingUnderscore: 'allow' },
                { selector: 'memberLike', format: ['camelCase'] },
                { selector: 'typeLike', format: ['PascalCase'] },
            ],
            '@typescript-eslint/no-confusing-void-expression': ['error'],
            '@typescript-eslint/no-empty-interface': ['warn'],
            '@typescript-eslint/no-inferrable-types': ['warn'],
            '@typescript-eslint/no-invalid-void-type': ['error'],
            'no-throw-literal': 'off',
            '@typescript-eslint/only-throw-error': ['error'],
            '@typescript-eslint/no-unnecessary-boolean-literal-compare': ['warn'],
            '@typescript-eslint/no-unnecessary-condition': ['warn'],
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_.*',
                    varsIgnorePattern: '^_.*',
                    caughtErrorsIgnorePattern: '^_.*',
                },
            ],
            '@typescript-eslint/no-useless-constructor': ['error'],
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/prefer-enum-initializers': ['error'],
            '@typescript-eslint/prefer-for-of': ['warn'],
            '@typescript-eslint/prefer-includes': ['warn'],
            '@typescript-eslint/prefer-optional-chain': ['warn'],
            '@typescript-eslint/prefer-readonly': ['warn'],
            '@typescript-eslint/prefer-string-starts-ends-with': ['warn'],
            '@typescript-eslint/unified-signatures': ['warn'],

            'no-undef': 0,
            'no-func-assign': 0,

            'padding-line-between-statements': [
                'error',
                {
                    blankLine: 'always',
                    prev: ['export', 'class'],
                    next: '*',
                },
            ],
        },
    },
];
