import { generatorHandler } from '@prisma/generator-helper';
import { onGenerate } from './on-generate';
import { onManifest } from './on-manifest';

console.log('Hello from local prisma-json-types-generator!');

// Defines the entry point of the generator.
generatorHandler({
  onManifest,
  onGenerate
});
