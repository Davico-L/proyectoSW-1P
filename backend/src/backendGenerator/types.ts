export interface UmlAttribute {
  name: string;
  type: string;
  visibility: string;
}

export interface UmlMethod {
  name: string;
  returnType: string;
  visibility: string;
}

export interface UmlClass {
  id: string;
  className: string;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
}

export type UmlRelationType =
  | "association"
  | "inheritance"
  | "composition"
  | "aggregation"
  | "manyToMany";

export interface UmlRelation {
  relationType: UmlRelationType;
  sourceClassId: string;
  targetClassId: string;
  multiplicitySource: string;
  multiplicityTarget: string;
}

export interface UmlModel {
  classes: UmlClass[];
  relations: UmlRelation[];
}
