/**
 * Copyright IBM Corp. 2018, 2018
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const iconMetadata = require('@carbon/icons/metadata.json');
const { toString } = require('@carbon/icon-helpers');
const { reporter } = require('@carbon/cli-reporter');
const fs = require('fs-extra');
const { dirname } = require('path');
const { param } = require('change-case');
const ngc = require('@angular/compiler-cli/src/main');
const { rollup } = require('rollup');
const { componentTemplate, storyTemplate } = require('./templates-compat');
const paths = require('./paths');

async function generateComponents() {
  // loop through the icons meta array
  for (const iconMeta of iconMetadata.icons) {
    for (const icon of iconMeta.output) {
      const className = icon.moduleName;
      const selectorName = param(icon.moduleName);
      const rawSvg = toString(icon.descriptor);
      const outputPath = `ts/${icon.filepath.replace('.js', '.ts')}`;
      // try to write out the component
      try {
        await fs.ensureDir(dirname(outputPath));
        await fs.writeFile(
          outputPath,
          componentTemplate(
            selectorName,
            className,
            rawSvg,
            icon.descriptor.attrs
          )
        );
      } catch (err) {
        reporter.error(err);
      }
    }
  }
}

async function buildUMD() {
  for (const iconMeta of iconMetadata.icons) {
    for (const icon of iconMeta.output) {
      const jsSource = `dist/lib/${icon.filepath}`;
      const iconbundle = await rollup({
        input: jsSource,
        external: ['@angular/core', '@carbon/icon-helpers'],
        cache: false,
        onwarn(warning, warn) {
          if (warning.code === 'THIS_IS_UNDEFINED') return;
          warn(warning);
        },
      });

      const jsOutput = jsSource.replace('lib', 'umd');
      await iconbundle.write({
        name: 'CarbonIconsAngular',
        format: 'umd',
        file: jsOutput,
        globals: {
          '@carbon/icon-helpers': 'CarbonIconHelpers',
          '@angular/core': 'ng.Core',
        },
      });
    }
  }
}

async function buildExamples() {
  await fs.copy(paths.LIB, paths.EXAMPLES_LIB);
  const grouped = new Map();
  for (const icon of icons) {
    if (!grouped.has(icon.basename)) {
      grouped.set(icon.basename, []);
    }
    grouped.get(icon.basename).push(icon);
  }
  let filesToWrite = [];
  for (const [basename, icons] of grouped) {
    filesToWrite.push(
      fs.writeFile(
        `${paths.STORIES}/${basename}.stories.ts`,
        storyTemplate(basename, icons)
      )
    );
  }
  await Promise.all(filesToWrite);
}

async function build() {
  reporter.log('Prepping build dirs...');
  try {
    await Promise.all([fs.ensureDir(paths.STORIES), fs.ensureDir(paths.TS)]);
  } catch (err) {
    reporter.error(err);
  }
  reporter.log('Generating source components...');
  await generateComponents();
  reporter.log('Compiling and generating modules...');
  // run the angular compiler over everything
  ngc.main(['-p', './config/tsconfig-aot.json']);
  reporter.log('Bundling...');
  await buildUMD();
  // build the storybook examples
  // reporter.log('Generating storybook examples...');
  // buildExamples();
}

module.exports = build;
