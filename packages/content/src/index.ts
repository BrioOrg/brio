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
  DrawingOptions,
  SolidEdge,
  SolidArc,
  SolidDrawing,
  SolidFace,
  CubeShade,
  DrawingCubeFace,
  DrawingTransformation,
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
  TransformationKind,
  FigureTransformation,
  FigureVector,
  FigureLine,
  FigureRay,
  TransformationMotion,
  Affine,
  SvgFrame,
  SvgBox,
  DrawingVector,
  FigureGeometryIssue,
  FigureGeometryIssueCode,
} from './transformations'
export {
  PRIME,
  affineAt,
  applyAffine,
  checkFigureGeometry,
  expandTransformations,
  imageName,
  imageOf,
  motionOf,
  placementToward,
  svgAffineAt,
  svgMatrix,
} from './transformations'

export type {
  ExpressionNode,
  ExpressionFunction,
  ExpressionError,
  Expression,
  ParseResult,
  ParseOptions,
} from './expression'
export { parseExpression } from './expression'

export type {
  FigureFunction,
  FigureReading,
  FigureParameter,
  FunctionPlotSpec,
  CompiledFunction,
  DrawingFunctionCurve,
  DrawingCurveLabel,
  DrawingReading,
  DrawingFunctionPlot,
} from './function-plot'
export {
  buildFunctionPlot,
  bindFunction,
  compileFunctions,
  formatReadingValue,
  parameterScope,
  sampleCurve,
  solveFor,
} from './function-plot'

export type { FunctionIssue } from './function-rules'
export {
  checkFunctionPlot,
  MAX_FUNCTIONS,
  MAX_PARAMETER_NOTCHES,
  MAX_PARAMETERS,
  MAX_READINGS,
} from './function-rules'

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
  SolidKind,
  SolidPlanePoint,
  SolidSectionPlane,
  SolidSection,
  SpherePoint,
  SolidSpec,
  SolidView,
  SolidShade,
  SolidLabel,
  SolidFrame,
  SolidGeometry,
  SolidKey,
  SolidStrokeState,
} from './solid'
export {
  buildSolidGeometry,
  projectSolid,
  solidStrokes,
  clampView,
  dragView,
  stepView,
  dragVelocity,
  coastView,
  interpolateView,
  sameView,
  SOLID_INITIAL_VIEW,
  SOLID_SIZE,
  SOLID_VIEWBOX,
} from './solid'

export type { SolidIssue, SolidIssueCode } from './solid-rules'
export {
  checkSolid,
  solidNameCount,
  SOLID_KINDS,
  SOLID_DIMENSIONS,
  SOLID_SECTION_PLANES,
  SOLID_MAX_BASE_VERTICES,
  SOLID_MAX_SPHERE_LINES,
  SPHERE_ONLY_FIELDS,
} from './solid-rules'

export type {
  ScratchOperator,
  ScratchValue,
  ScratchStatement,
  ScratchError,
  ScratchErrorCode,
  ScratchErrorParams,
  ScratchParseResult,
  ScratchCategory,
  ScratchPart,
  ScratchBlock,
} from './scratch'
export { parseScratch, buildScratchModel } from './scratch'

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
