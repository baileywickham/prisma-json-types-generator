import { join } from 'node:path';
import type { GeneratorOptions } from '@prisma/generator';
import ts from 'typescript';
import { handlePrismaModule } from './handler/module';
import { type PrismaEntity, extractPrismaModels } from './helpers/dmmf';
import { parseConfig } from './util/config';
import { DeclarationWriter } from './util/declaration-writer';
import { findPrismaClientGenerator } from './util/prisma-generator';
import { buildTypesFilePath } from './util/source-path';

/** Runs the generator with the given options. */
export async function onGenerate(options: GeneratorOptions) {
  console.time('onGenerate total');
  try {
    console.time('findPrismaClientGenerator');
    const prismaClient = findPrismaClientGenerator(options.otherGenerators);
    console.timeEnd('findPrismaClientGenerator');

    console.time('parseConfig');
    const config = parseConfig(options.generator.config);
    console.timeEnd('parseConfig');

    const isNewClient =
      (prismaClient.provider.fromEnvVar || prismaClient.provider.value) === 'prisma-client';
    const clientOutput = isNewClient
      ? join(prismaClient.output.value, 'client.ts')
      : buildTypesFilePath(prismaClient.output.value, config.clientOutput, options.schemaPath);

    console.time('DeclarationWriter init');
    const writer = new DeclarationWriter(clientOutput, config);
    console.timeEnd('DeclarationWriter init');

    // Reads the prisma declaration file content.
    console.time('writer.load');
    await writer.load();
    console.timeEnd('writer.load');

    console.time('ts.createSourceFile');
    const tsSource = ts.createSourceFile(
      writer.filepath,
      writer.content,
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TS
    );
    console.timeEnd('ts.createSourceFile');

    console.time('extractPrismaModels');
    const { typeToNameMap, modelMap, knownNoOps } = extractPrismaModels(options.dmmf);
    console.timeEnd('extractPrismaModels');

    console.time('createModelMap');
    console.timeEnd('createModelMap');

    // Handles the prisma namespace.
    console.time('handlePrismaModule loop');
    tsSource.forEachChild((child) => {
      try {
        if (child.kind === ts.SyntaxKind.ModuleDeclaration) {
          handlePrismaModule(
            child as ts.ModuleDeclaration,
            writer,
            modelMap,
            knownNoOps,
            typeToNameMap,
            config
          );
        }
      } catch (error) {
        console.error(error);
      }
    });
    console.timeEnd('handlePrismaModule loop');

    console.time('writer.save');
    await writer.save();
    console.timeEnd('writer.save');
  } catch (error) {
    console.error(error);
  } finally {
    console.timeEnd('onGenerate total');
  }
}
