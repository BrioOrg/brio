export type { RichTextToken } from './rich-text'
export { parseRichText } from './rich-text'

export type {
  LabelPlacement,
  FigurePoint,
  FigureLineStyle,
  FigureSegment,
  FigurePolygon,
  FigureCircle,
  FigureArc,
  FigureAngleMark,
  FigureLengthMark,
  FigureLabel,
  FigureNumberLine,
  FigurePolyline,
  FigureAxis,
  FigureAxes,
  FigureSolid,
  CoordinateSpace,
  FigureSpec,
  DrawingSegment,
  DrawingStroke,
  DrawingPolygon,
  DrawingShape,
  DrawingCurve,
  DrawingCircle,
  DrawingRightAngleSquare,
  DrawingAngleArc,
  DrawingLengthTick,
  DrawingDot,
  DrawingPointLabel,
  DrawingFreeLabel,
  DrawingNumberLine,
  DrawingPolyline,
  DrawingText,
  DrawingAxis,
  DrawingAxes,
  DrawingModel,
  SolidEdge,
  SolidArc,
  SolidDrawing,
  SolidFace,
  CubeShade,
  DrawingCubeFace,
} from './figure'
export {
  buildDrawingModel,
  expandSolid,
  formatNumber,
  angleDegrees,
  euclideanLength,
  isCollinear,
} from './figure'

export type {
  ChartKind,
  ChartDatum,
  ChartSeries,
  ChartSpec,
  ChartText,
  ChartValueAxis,
  ChartBar,
  ChartSector,
  ChartModel,
} from './chart'
export { buildChartModel, niceStep, valueScale, wrapLabel } from './chart'

export type { ChartIssue, ChartIssueCode } from './chart-rules'
export {
  checkChart,
  maxCategories,
  CHART_AXIS_FIELDS,
  CHART_MAX_CATEGORIES,
  CHART_MAX_GRADUATIONS,
  CHART_MIN_CATEGORIES,
  PIE_MAX_CATEGORIES,
} from './chart-rules'

export type {
  TreeOrientation,
  TreeNodeSpec,
  TreeSpec,
  TreeLabelRole,
  TreeLabelContent,
  TreeLabel,
  TreeBranch,
  TreePathRow,
  TreeModel,
  TreeLayoutOptions,
} from './tree'
export {
  buildTreeModel,
  estimateLatex,
  estimateRichText,
  outcomeText,
  productLatex,
  treeCollisions,
} from './tree'

export type {
  Rational,
  ParsedProbability,
  TreeIssue,
  TreeIssueCode,
  TreeIssueSeverity,
  TreeNodeInput,
} from './tree-rules'
export {
  checkTree,
  findPath,
  leafPaths,
  parseProbability,
  probabilityValue,
  rationalString,
  TREE_MAX_CHILDREN,
  TREE_MAX_DEPTH,
  TREE_MAX_LEAVES,
} from './tree-rules'

export type {
  ScratchOperator,
  ScratchComparator,
  ScratchLogical,
  ScratchBoolean,
  ScratchValue,
  ScratchStatement,
  ScratchError,
  ScratchErrorCode,
  ScratchErrorParams,
  ScratchBlockType,
  ScratchParseResult,
  ScratchCategory,
  ScratchPart,
  ScratchBlock,
} from './scratch'
export { parseScratch, buildScratchModel } from './scratch'

export type {
  ScratchRuntimeValue,
  ScratchEvalError,
  ScratchEvalErrorCode,
  ScratchEvalResult,
  ScratchEvalOptions,
} from './scratch-eval'
export { evaluateScratch, toNumber } from './scratch-eval'

export type {
  CalculMode,
  CalculLine,
  CalculSpec,
  CalculParts,
  CalculSplit,
  CalculSplitError,
  CalculRow,
  CalculModel,
  CalculIssue,
  CalculIssueCode,
} from './calcul'
export {
  buildCalculModel,
  calculSteps,
  checkCalcul,
  focusRanges,
  scanLatex,
  splitCalculLine,
  wrapFocus,
  CALCUL_FOCUS_TONE,
  CALCUL_MAX_LINES,
  CALCUL_MIN_LINES,
  CALCUL_NOTE_MAX_LENGTH,
} from './calcul'

export type { DeckBlock, DeckSection, DeckInput, Diapo } from './deck'
export { buildDeck, RESERVED_DIAPO_IDS } from './deck'

export type { Tone, ToneIssue, ToneIssueCode } from './tone'
export { TONES, MAX_TONES_PER_BLOCK, isTone, toneArguments, checkTones } from './tone'
