        const candidatosEnMismoPuesto = candidatosOrdenados.filter(
          (c) => (c.votos || 0) === votos
        );
        const hayEmpateEnPuesto = candidatosEnMismoPuesto.length > 1;
        if (hayEmpateEnPuesto) {
          textoPuesto = "Empate";
        } else {
        const puestoBase = indice + 1;
        textoPuesto = puestoBase === 1 ? "1er puesto" : puestoBase === 2 ? "2do puesto" : "3er puesto";
        }
      }

      return { candidato, medalla, textoPuesto, votos };
    });

    info.forEach((item) => {
      puestosCalculados.set(item.candidato.id, item);
    });
  }

  const usados = new Set();