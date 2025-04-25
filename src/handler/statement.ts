import ts from 'typescript';
import type { PrismaEntity, Trie } from '../helpers/dmmf';
import { extractBaseNameFromRelationType } from '../helpers/regex';
import type { PrismaJsonTypesGeneratorConfig } from '../util/config';
import type { DeclarationWriter } from '../util/declaration-writer';
import { handleModelPayload } from './model-payload';
import { replaceObject } from './replace-object';

// Initialize metrics object (Ideally place this outside the loop calling handleStatement)
export const statementMetrics = {
  totalCalls: 0,
  skippedNotTypeLiteral: 0,
  skippedKnownNoOps: 0,
  modelNameFound: 0,
  modelNameNotFound: 0,
  payloadHandled: 0,
  objectReplacedViaModelName: 0,
  baseNameExtracted: 0,
  baseNameNotExtracted: 0,
  objectReplacedViaBaseName: 0,
  noMatchFound: 0
};

/**
 * Handles a Prisma namespace statement, can be a model type, a model payload or a model
 * where/create/update input/output
 */
export function handleStatement(
  statement: ts.Statement,
  writer: DeclarationWriter,
  modelMap: Map<string, PrismaEntity>,
  typeToNameMap: Map<string, string>,
  knownNoOps: Set<string>,
  config: PrismaJsonTypesGeneratorConfig
) {
  statementMetrics.totalCalls++; // Count total calls

  if (statement.kind !== ts.SyntaxKind.TypeAliasDeclaration) {
    // Although the check below also filters, adding a specific counter here if needed.
    return;
  }

  const type = statement as ts.TypeAliasDeclaration;

  // Filters any statement that isn't a export type declaration
  if (type.type.kind !== ts.SyntaxKind.TypeLiteral) {
    statementMetrics.skippedNotTypeLiteral++; // Count skipped non-TypeLiteral
    return;
  }

  if (knownNoOps.has(type.name.getText())) {
    statementMetrics.skippedKnownNoOps++; // Count skipped known no-ops
    return;
  }

  const typeName = type.name.getText();

  // Goes through each model and checks if the type name matches any of the regexps
  console.time(`typeNameHandling: ${typeName}`); // Start timing
  const modelName = typeToNameMap.get(typeName);
  if (modelName) {
    statementMetrics.modelNameFound++; // Count model name found
    const model = modelMap.get(modelName);
    if (model) {
      // Using typeName directly in the label as model.name might cause type issues
      if (typeName === `$${modelName}Payload`) {
        // Check against modelName used for lookup
        statementMetrics.payloadHandled++; // Count payload handled
        console.timeEnd(`typeNameHandling: ${typeName}`); // End timing
        return handleModelPayload(type, writer, model, config);
      }
      statementMetrics.objectReplacedViaModelName++; // Count object replaced (via modelName)
      console.timeEnd(`typeNameHandling: ${typeName}`); // End timing
      return replaceObject(type.type as ts.TypeLiteralNode, writer, model, config);
    }
    // Note: Consider adding a counter here if model is not found in modelMap despite modelName existing
  } else {
    statementMetrics.modelNameNotFound++; // Count model name not found initially
    const baseName = extractBaseNameFromRelationType(typeName);
    if (baseName) {
      statementMetrics.baseNameExtracted++; // Count base name extracted
      const model = modelMap.get(baseName);
      if (model) {
        statementMetrics.objectReplacedViaBaseName++; // Count object replaced (via baseName)
        console.timeEnd(`typeNameHandling: ${typeName}`); // End timing (moved inside before return)
        return replaceObject(type.type as ts.TypeLiteralNode, writer, model, config);
      }
      throw new Error('bad');
      // Note: Consider adding a counter here if model is not found in modelMap despite baseName existing
    }
    console.log('baseNameNotExtracted', typeName);
    statementMetrics.baseNameNotExtracted++; // Count base name extraction failed
  }

  statementMetrics.noMatchFound++; // Count cases where no return path was taken
  console.timeEnd(`typeNameHandling: ${typeName}`); // End timing (if no return occurred)

  // const baseName = extractBaseNameFromRelationType(typeName);

  // for (const model of models) {
  //     // console.log(name)
  //     // If this is the main model payload type
  //     if (typeName === `$${model.name}Payload`) {
  //         if (!res.found) {
  //             console.log('error',res, typeName);
  //         }
  //         return handleModelPayload(type, writer, model, config);
  //     }

  //     // If this statement matches some create/update/where input/output type
  //     for (const regexp of model.regexps) {
  //         if (regexp.test(typeName)) {
  //             if (!res.found && baseName !== model.name) {
  //                 console.log('error', typeName, res);
  //             }
  //             return replaceObject(type.type as ts.TypeLiteralNode, writer, model, config);
  //         }
  //     }

  // No model found for this statement, just ignore this type.
  // }
}
