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

export type { DeckBlock, DeckSection, DeckInput, Diapo } from './deck'
export { buildDeck, RESERVED_DIAPO_IDS } from './deck'
