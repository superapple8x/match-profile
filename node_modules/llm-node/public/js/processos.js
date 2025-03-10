/*
 *
 * /js/processos.js
 *
 */

(function($) {
    $.QueryString = (function(a) {
        if (a == "") return {};
        var b = {};
        for (var i = 0; i < a.length; ++i)
        {
            var p=a[i].split('=');
            if (p.length != 2) continue;
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
        }
        return b;
    })(window.location.search.substr(1).split('&'))
})(jQuery);

function popularFiltroOld(loadUrl, id){
	$.getJSON({
		url: loadUrl,
		success: function(data){
			var fields = data.categorias || data;
			$( id ).empty(); //verificar se dá problema...
			if (fields==null) {
				$(id).append('<option>Nenhum filtro encontrado.<option>');
				return;
				}
			$(id).append('<option>Selecione uma opção</option>');
			$.each( fields, function(i,option ) {
				if (option.alias != '' && option.alias != undefined) {
					$( id ).append( '<option value="' + option.id + '">' + option.alias + '</option>');
				} else if (option.fullName!='' && option.fullName != undefined) {
					$( id ).append( '<option value="' + option.id.$oid + '">' + option.fullName + '</option>');
					}
				});
			}
		});
	}

function popularFiltroCategoria(tipo, id){
	popularFiltro('/api/categorias/tipo/'+tipo, id);
	}

function carregarFiltros(){
	// tipos = { url , ID no HTML }
	var tipos = [
		["acomp","#acomp"],
		["adv","#advogado"],
		["resp","#responsavel"],
		["uf","#estado"],
		["instancia","#comarca"],
		["numVara","#numVAra"],
		["natAcao","#natAcao"],
		["natVara","#natVara"],
		["status","#status"],
		["fase","#fase"]];
	var pessoas = [
		["/api/clientes","#cliente"],
		["/api/pessoas/filtro/parteCliente","#parteCliente"],
		["/api/pessoas/filtro/parteContraria","#parteContraria"]];
/*	var pessoas = [
		["l=100&sk=0&f={alias:1,_id:1}}&s={alias:1}}&q={}","#cliente"],
		['l=100&sk=0&f={fullName:1,_id:1}}&s={fullName:1}}&q={eParteClienteLegado:"S"}',"#parteCliente"],
		['l=100&sk=0&f={fullName:1,_id:1}}&s={fullName:1}}&q={eParteContrariaLegado:"S"}',"#parteContraria"]];*/
/*	$.each(tipos,function(i,obj){
		popularFiltroCategoria(obj[0], obj[1])
		});
	$.each(pessoas,function(i,obj){
		popularFiltro(obj[0], obj[1])
		});
	*/

	$.getJSON({
		url: "/api/categorias",
		success: function(data){
			for each (tipo in tipos) {
				$( tipo[1] ).empty(); //verificar se dá problema...
				if (data.items==null) {
					$(tipo[1]).append('<option value="null" disabled>Nenhum filtro encontrado.<option>');
					return;
				}
				$(tipo[1]).append('<option value="null" disabled>Selecione uma opção:</option>');
				for each (item in data.items) {
					if (item.tipo == tipo[0]) {
						$( tipo[1] ).append( '<option value="' + item.id + '">' + item.alias + ' ' + item.fullName + '</option>');
					}
				};
			}
			
		});
	}

}

/*
 *
 * function carregarComarcas(uf)
 * returns: void
 * description: loads every courthouse and county.
 */
function carregarComarcas(uf){
	$.getJSON({
		url:'/api/comarcas',
		success: function comarcasSucesso(data){
			var fields=data.comarcas;
			$.each(fields, function(i,option){
				$('comarca').append('<option name="' + option.id + '">' + option.alias + '</option>');
				});
			}
		});
	} // [END] carregarComarcas

function tabelaProcessosLinha(i,processo){
	var retorno = '<tr>';
	retorno += '<td>'+processo.acomp;
	if (processo.link!='') {
		retorno+= '&nbsp;(<a href="' + processo.link + '" target="_blank">Abrir link</a>)';
		}
	retorno += '</td>';
	retorno += '<td><a href="/processos/' + processo.id + '">' + processo.numero + '&nbsp;<small>(Abrir)</small></a></td>';
	retorno += '<td>'+ processo.cliente + '</td>';
	retorno += '<td>'+ processo.parteCliente + '</td>';
	retorno += '<td>'+ processo.parteContraria + '</td>';
	retorno += '<td>'+ processo.advogado + '</td>';
	retorno += '<td>'+ processo.responsavel + '</td>';
	retorno += '<td>'+ processo.comarca + '/'+ processo.estado + '&nbsp;(' + processo.instancia + ')<br /><small>' + processo.legacyComarca + '</small></td>';
	retorno += '<td>'+ processo.numVara + '&nbsp;' + processo.natVara + '</td>';
	retorno += '<td>'+ processo.fase + '/' + processo.status+ '</td>';
	retorno += '<td>'+ processo.observacoes + '</td>';
	retorno += '</tr>';
	return retorno;
	}

function carregarTabela() {
	$("#tdCarregando").addClass("fa fa-spinner fa-spin fa-lg")
	var filtros = $('#filtro').serializeArray();
	//window.alert(JSON.stringify(filtros));
	qs = '/api/processos?pageToken='+$.QueryString('pageToken');
	$.ajax({
		url: '/api/processos/'+,
		dataType: 'json',
		success: function(data){
			//var fields = $( ":input" ).serializeArray();
			var fields = data.items;
			window.alert(fields);
			$( "#tabelaProcessos" ).empty();
			if (fields==null) {
				$("tabelaProcessos").append("Nenhum processo encontrado");
				}
			$.each( fields, function(i,linha ) {
				$( "#tabelaProcessos" ).append( tabelaProcessosLinha(i,linha));
				});
			}
		});
	}
//$( ":checkbox, :radio" ).click( carregarTabela );
$( "select" ).change( carregarTabela );


