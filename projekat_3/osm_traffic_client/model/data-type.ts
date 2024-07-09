export enum DataType {
  String = "xsd:string",
  Integer = "xsd:int",
  Long = "xsd:long",
  Float = "xsd:float",
  Double = "xsd:double",
  Decimal = "xsd:decimal",
  Boolean = "xsd:boolean",
  Date = "xsd:date",
  DateTime = "xsd:dateTime",
  Time = "xsd:time",
  Geometry = "gml:GeometryPropertyType",
  Point = "gml:PointPropertyType",
  LineString = "gml:LineString",
  Polygon = "gml:Polygon",
  MultiPoint = "gml:MultiPoint",
  MultiLineString = "gml:MultiLineString",
  MultiPolygon = "gml:MultiPolygon",
  FeatureCollection = "gml:FeatureCollection",
  CurveProperty = "gml:CurvePropertyType",
  Unknown = "unknown",
}