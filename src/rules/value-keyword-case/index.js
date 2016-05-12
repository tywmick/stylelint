import valueParser from "postcss-value-parser"
import { isString } from "lodash"
import {
  declarationValueIndex,
  isCustomIdentPropertyAnimationName,
  isCustomIdentPropertyCounterIncrement,
  isStandardValue,
  matchesStringOrRegExp,
  report,
  ruleMessages,
  validateOptions,
} from "../../utils"
import { camelCaseKeywords } from "../../reference/keywordSets"

export const ruleName = "value-keyword-case"

export const messages = ruleMessages(ruleName, {
  expected: (actual, expected) => `Expected "${actual}" to be "${expected}"`,
})

// Operators are interpreted as "words" by the value parser, so we want to make sure to ignore them.
const ignoredCharacters = new Set([
  "+", "-", "/", "*", "%",
])

const mapLowercaseKeywordsToCamelCase = new Map()
camelCaseKeywords.forEach(func => {
  mapLowercaseKeywordsToCamelCase.set(func.toLowerCase(), func)
})

export default function (expectation, options) {
  return (root, result) => {
    const validOptions = validateOptions(result, ruleName, {
      actual: expectation,
      possible: [
        "lower",
        "upper",
      ],
    }, {
      actual: options,
      possible: {
        ignoreKeywords: [isString],
      },
      optional: true,
    })
    if (!validOptions) { return }

    root.walkDecls(decl => {
      const { prop, value } = decl

      valueParser(value).walk((node) => {
        // Ignore keywords within `url` and `var` function
        const valueLowerCase = node.value.toLowerCase()
        if (
          node.type === "function" && (
            valueLowerCase === "url" ||
            valueLowerCase === "var"
          )
        ) { return false }

        const keyword = node.value

        // Ignore css variables, and hex values, and math operators, and sass interpolation
        if (node.type !== "word"
          || !isStandardValue(node.value)
          || value.indexOf("#") !== -1
          || ignoredCharacters.has(keyword)
        ) { return }

        if (prop === "animation-name" && isCustomIdentPropertyAnimationName(valueLowerCase)) { return }
        if (prop === "counter-increment" && isCustomIdentPropertyCounterIncrement(valueLowerCase)) { return }

        const parsedUnit = valueParser.unit(keyword)

        if (parsedUnit !== false) { return }

        const ignoreKeywords = options && options.ignoreKeywords || []

        if (ignoreKeywords.length > 0 && matchesStringOrRegExp(keyword, ignoreKeywords)) { return }

        const keywordLowerCase = keyword.toLocaleLowerCase()
        let expectedKeyword = null

        if (expectation === "lower"
          && mapLowercaseKeywordsToCamelCase.has(keywordLowerCase)
        ) {
          expectedKeyword = mapLowercaseKeywordsToCamelCase.get(keywordLowerCase)
        } else if (expectation === "lower") {
          expectedKeyword = keyword.toLowerCase()
        } else {
          expectedKeyword = keyword.toUpperCase()
        }

        if (keyword === expectedKeyword) { return }

        report({
          message: messages.expected(keyword, expectedKeyword),
          node: decl,
          index: declarationValueIndex(decl) + node.sourceIndex,
          result,
          ruleName,
        })
      })
    })
  }
}
