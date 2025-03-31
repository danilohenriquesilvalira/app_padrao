package plc

import (
	"log"
	"math"
	"reflect"
)

// CompareValues compara dois valores de forma robusta, tratando números com tolerância.
// Se os valores forem numéricos, eles são convertidos para float64 e comparados com uma tolerância.
func CompareValues(old, new interface{}) bool {
	// Se ambos forem nil, são iguais.
	if old == nil && new == nil {
		return true
	}
	// Se apenas um for nil, são diferentes.
	if old == nil || new == nil {
		return false
	}

	// Log para depuração da comparação
	oldType := reflect.TypeOf(old)
	newType := reflect.TypeOf(new)
	if oldType != newType {
		log.Printf("CompareValues: Comparando valores de tipos diferentes: %T e %T", old, new)
	}

	// Se os tipos são exatamente iguais, para números usa tolerância.
	if reflect.TypeOf(old) == reflect.TypeOf(new) {
		switch old.(type) {
		case float32, float64:
			oldNum, okOld := toFloat64(old)
			newNum, okNew := toFloat64(new)
			if okOld && okNew {
				// Usa tolerância aumentada para evitar falsas mudanças por arredondamento
				return math.Abs(oldNum-newNum) < 1e-5
			}
		case bool:
			// Comparação direta para booleanos
			return old.(bool) == new.(bool)
		}
		// Para os demais tipos, pode usar comparação direta.
		return old == new
	}

	// Se os tipos diferem, tenta converter ambos para float64 (para números).
	oldNum, okOld := toFloat64(old)
	newNum, okNew := toFloat64(new)
	if okOld && okNew {
		return math.Abs(oldNum-newNum) < 1e-5
	}

	// Se um dos valores é booleano, tenta uma comparação especial
	if oldBool, okOld := old.(bool); okOld {
		if newNum, okNew := toFloat64(new); okNew {
			return (oldBool && newNum != 0) || (!oldBool && newNum == 0)
		}
	}
	if newBool, okNew := new.(bool); okNew {
		if oldNum, okOld := toFloat64(old); okOld {
			return (newBool && oldNum != 0) || (!newBool && oldNum == 0)
		}
	}

	// Fallback para comparação profunda e log do resultado
	result := reflect.DeepEqual(old, new)
	if !result {
		log.Printf("CompareValues: Valores diferentes após DeepEqual: %v (%T) vs %v (%T)",
			old, old, new, new)
	}
	return result
}

// toFloat64 tenta converter um valor numérico para float64.
func toFloat64(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case int:
		return float64(n), true
	case int8:
		return float64(n), true
	case int16:
		return float64(n), true
	case int32:
		return float64(n), true
	case int64:
		return float64(n), true
	case uint:
		return float64(n), true
	case uint8:
		return float64(n), true
	case uint16:
		return float64(n), true
	case uint32:
		return float64(n), true
	case uint64:
		return float64(n), true
	case float32:
		return float64(n), true
	case float64:
		return n, true
	case bool:
		if n {
			return 1.0, true
		}
		return 0.0, true
	default:
		// Tenta converter outros tipos numéricos
		value := reflect.ValueOf(v)
		switch value.Kind() {
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			return float64(value.Int()), true
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			return float64(value.Uint()), true
		case reflect.Float32, reflect.Float64:
			return value.Float(), true
		}
		return 0, false
	}
}
