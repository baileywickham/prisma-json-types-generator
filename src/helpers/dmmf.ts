import type DMMF from '@prisma/dmmf';
import { createRegexForType, generateTypeNamesFromName } from './regex';
import { parseTypeSyntax } from './type-parser';

class TrieNode {
  children: Record<string, TrieNode>;
  isEndOfWord: boolean;
  name?: string;
  constructor() {
    this.children = {};
    this.isEndOfWord = false;
  }
}

export class Trie {
  root: TrieNode;

  constructor() {
    this.root = new TrieNode();
  }

  insert({ name, types }: { name: string; types: string[] }) {
    for (const type of types) {
      let node = this.root;
      for (let i = 0; i < type.length; i++) {
        const char = type[i];
        if (!node.children[char!]) {
          node.children[char!] = new TrieNode();
        }
        node = node.children[char!]!;
      }
      node.isEndOfWord = true;
      node.name = name;
    }
  }

  search(word: string) {
    let node = this.root;

    for (let i = 0; i < word.length; i++) {
      const char = word[i];

      if (!node.children[char!]) {
        return false;
      }
      node = node.children[char!]!;
    }
    return node.isEndOfWord;
  }

  prefix(prefix: string) {
    let node = this.root;
    for (let i = 0; i < prefix.length; i++) {
      const char = prefix[i];
      if (!node.children[char!]) {
        return { name: undefined, found: false };
      }
      node = node.children[char!]!;
    }
    return { name: node.name, found: true };
  }
}

/** A Prisma DMMF model/type with the regexes for each field. */
export interface PrismaEntity extends DMMF.Model {
  regexps: RegExp[];
  type: 'model' | 'type';
}

/**
 * Parses the DMMF document and returns a list of models that have at least one field with
 * typed json and the regexes for each field type.
 */
export function extractPrismaModels(dmmf: DMMF.Document): {
  typeToNameMap: Map<string, string>;
  modelMap: Map<string, PrismaEntity>;
  knownNoOps: Set<string>;
} {
  const models = dmmf.datamodel.models
    // Define the regexes for each model
    .map(
      (model): PrismaEntity => ({
        ...model,
        type: 'model',
        regexps: createRegexForType(model.name)
      })
    );
  const types = dmmf.datamodel.types
    // .filter(t => t.fields.some(f => parseTypeSyntax(f.documentation)))
    // Define the regexes for each model
    .map(
      (model): PrismaEntity => ({
        ...model,
        type: 'type',
        regexps: createRegexForType(model.name)
      })
    );
  const allModels = [];

  const knownNoOps = new Set<string>();
  for (const m of models.concat(types)) {
    if (m.fields.every((f) => !parseTypeSyntax(f.documentation))) {
      knownNoOps.add(m.name);
    } else {
      allModels.push(m);
    }
  }
  const typeToNameMap = new Map<string, string>();
  allModels.forEach((m) => {
    const operations = generateTypeNamesFromName(m.name);
    operations.forEach((o) => {
      typeToNameMap.set(o, m.name);
    });
  });
  const modelMap = new Map<string, PrismaEntity>();
  allModels.forEach((m) => {
    modelMap.set(m.name, m);
  });
  return { typeToNameMap, modelMap, knownNoOps };
}
