import ts from 'typescript';
import type { PrismaEntity, Trie } from '../helpers/dmmf';
import type { PrismaJsonTypesGeneratorConfig } from '../util/config';
import { PRISMA_NAMESPACE_NAME } from '../util/constants';
import type { DeclarationWriter } from '../util/declaration-writer';
import { PrismaJsonTypesGeneratorError } from '../util/error';
import { handleStatement, statementMetrics } from './statement';

/** Handles the prisma namespace module. */
export function handlePrismaModule(
  child: ts.ModuleDeclaration,
  writer: DeclarationWriter,
  modelMap: Map<string, PrismaEntity>,
  knownNoOps: Set<string>,
  typeToNameMap: Map<string, string>,
  config: PrismaJsonTypesGeneratorConfig
) {
  // console.log(child.getChildren())
  const name = child
    .getChildren()
    .find((n): n is ts.Identifier => n.kind === ts.SyntaxKind.Identifier);
  console.log(name?.text);

  // Not a prisma namespace
  if (!name || name.text !== PRISMA_NAMESPACE_NAME) {
    return;
  }

  const content = child
    .getChildren()
    .find((n): n is ts.ModuleBlock => n.kind === ts.SyntaxKind.ModuleBlock);

  if (!content || !content.statements.length) {
    throw new PrismaJsonTypesGeneratorError('Prisma namespace content could not be found');
  }

  // Loops through all statements in the prisma namespace
  console.time('handleStatement loop');
  // console.log(content.statements);
  for (const statement of content.statements.filter(
    (s): s is ts.TypeAliasDeclaration => s.kind === ts.SyntaxKind.TypeAliasDeclaration
  )) {
    // console.time(`handleStatement: ${statement.kind}`); // Log kind for context
    try {
      handleStatement(statement, writer, modelMap, typeToNameMap, knownNoOps, config);
    } catch (error) {
      // This allows some types to be generated even if others may fail
      // which is good for incremental development/testing
      if (error instanceof PrismaJsonTypesGeneratorError) {
        return PrismaJsonTypesGeneratorError.handler(error);
      }

      // Stops this generator is error thrown is not manually added by our code.
      throw error;
    } finally {
      // console.timeEnd(`handleStatement: ${statement.kind}`);
    }
  }
  console.log(statementMetrics);
  console.timeEnd('handleStatement loop');
}
