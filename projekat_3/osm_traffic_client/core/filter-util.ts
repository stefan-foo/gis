import { format, parse } from "date-fns";
import { Attribute } from "../model/attribute";
import { DataType } from "../model/data-type";
import { Filter } from "../model/filter";
import { Operator } from "../model/operator";
import { LayerInfo } from "../model/layer-info";
import { Extent } from "ol/extent";

const dynamicallyGenerateFilter: { [key in DataType]: boolean } = {
  [DataType.String]: true,
  [DataType.Integer]: true,
  [DataType.Long]: true,
  [DataType.Float]: true,
  [DataType.Double]: true,
  [DataType.Decimal]: true,
  [DataType.Boolean]: false,
  [DataType.Date]: true,
  [DataType.DateTime]: true,
  [DataType.Time]: true,
  [DataType.Geometry]: false,
  [DataType.Point]: false,
  [DataType.LineString]: false,
  [DataType.Polygon]: false,
  [DataType.MultiPoint]: false,
  [DataType.MultiLineString]: false,
  [DataType.MultiPolygon]: false,
  [DataType.FeatureCollection]: false,
  [DataType.Unknown]: false,
  [DataType.CurveProperty]: false,
};

export function shouldDynamicallyGenerateFilter(dataType: DataType): boolean {
  return dataType ? dynamicallyGenerateFilter[dataType] ?? false : false;
}

export function possibleOperators(dataType: DataType): Operator[] {
  switch (dataType) {
    case DataType.String:
      return [Operator.Equal, Operator.NotEqual, Operator.Like, Operator.ILike];
    case DataType.Integer:
    case DataType.Long:
    case DataType.Float:
    case DataType.Double:
    case DataType.Decimal:
      return [
        Operator.Equal,
        Operator.NotEqual,
        Operator.LessThan,
        Operator.GreaterThan,
        Operator.LessThanOrEqual,
        Operator.GreaterThanOrEqual,
      ];
    case DataType.Boolean:
      return [Operator.Equal, Operator.NotEqual];
    case DataType.Date:
    case DataType.DateTime:
    case DataType.Time:
      return [
        Operator.Equal,
        Operator.NotEqual,
        Operator.LessThan,
        Operator.GreaterThan,
        Operator.LessThanOrEqual,
        Operator.GreaterThanOrEqual,
      ];
    default:
      return [];
  }
}

export function getGeometryAttribute(attributes: Attribute[]) {
  for (const attribute of attributes) {
    if (isGeometry(attribute.dataType)) {
      return attribute;
    }
  }
}

export function isGeometry(dataType: DataType): boolean {
  return (
    dataType === DataType.Geometry ||
    dataType === DataType.Point ||
    dataType === DataType.LineString ||
    dataType === DataType.Polygon ||
    dataType === DataType.MultiPoint ||
    dataType === DataType.MultiLineString ||
    dataType === DataType.MultiPolygon ||
    dataType === DataType.FeatureCollection ||
    dataType === DataType.CurveProperty
  );
}

export function convertToCql(filters: Filter[]) {
  return filters
    .map((filter) => {
      return `${filter.attribute.name} ${filter.operator} ${formatValue(
        filter.attribute.dataType,
        filter.operator,
        filter.value
      )}`;
    })
    .join(" AND ");
}

function formatValue(dataType: DataType, operator: Operator, value: any) {
  switch (dataType) {
    case DataType.String:
      if (operator == Operator.Like || operator == Operator.ILike) {
        return `'%${value}%'`;
      }
      return `'${value}'`;
    case DataType.DateTime:
    case DataType.Date:
      const parsedDate = parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
      return `'${format(parsedDate, "yyyy-MM-dd HH:mm:ss")}'`;
    default:
      return value;
  }
}

export function getCql(
  layer: LayerInfo,
  filters: Filter[],
  extent: Extent
): string | null {
  if (filters.length == 0) return null;

  const geometryAttribute = getGeometryAttribute(layer.attributes);
  if (!geometryAttribute) return null;

  return (
    `bbox(${geometryAttribute.name}, ${extent.join(",")})` +
    " AND " +
    convertToCql(filters)
  );
}
