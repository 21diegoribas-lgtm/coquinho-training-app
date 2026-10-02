import { BlockType, GameFormat } from '../types/session';

// Tactical content and phase differentiation. Allocations, dimensions, schema and diagrams stay with their existing owners.
interface FormatContext {
  focus: string;
  technicalName: string;
  setup: string;
  warmUp: string;
  technical: string;
  skill: string;
  conditionedGame: string;
  finalMatch: string;
  warmUpPoints: string[];
  technicalPoints: string[];
  skillPoints: string[];
  conditionedGamePoints: string[];
  finalMatchPoints: string[];
  warmUpProgression: string;
  technicalProgression: string;
  skillProgression: string;
  conditionedGameProgression: string;
  finalMatchProgression: string;
  equipment: Record<BlockType, string[]>;
}

const CONTEXT: Record<GameFormat, FormatContext> = {
  'Futsal 5v5': {
    focus: 'Hỗ trợ gần, bật tường nhanh và nhận bóng dưới áp lực tức thời trong không gian hẹp; chuyển trạng thái liên tục.',
    technicalName: 'Nhận bóng thoát áp lực gần và bật tường',
    setup: 'Giữ cự ly hỗ trợ gần, tạo góc chuyền chéo cạnh người nhận và một hướng thoát áp lực phía trước; đổi vị trí liên tục trong nhóm đã chia.',
    warmUp: 'Trong từng cặp, người chuyền dịch sang bên ngay sau đường chuyền. Người nhận kiểm tra vai, chạm bóng ra khỏi hướng áp sát giả định rồi trả bóng vào hướng di chuyển mới; đổi chân sau mỗi lượt.',
    technical: 'Trong mỗi nhóm nhỏ, bóng bắt đầu từ người hỗ trợ gần. Người nhận kiểm tra vai ngay trước khi bóng tới: nếu lưng bị khóa thì nhả một chạm và chạy nhận đường bật tường; nếu hướng trước trống thì chạm bóng thoát sang bên rồi chuyền tiến lên. Người vừa chuyền đi theo bóng đổi vai; người còn lại của nhóm làm điểm nối hoặc áp sát thụ động, luân phiên sau mỗi lượt.',
    skill: 'Trong hai đội đã chia, người gần bóng tạo quan hệ cục bộ 1v1, 2v1 hoặc 3v2 khi tình huống xuất hiện; đồng đội còn lại dịch chuyển làm hướng chuyền kế tiếp. Người nhận bị áp sát phải chọn bật tường hoặc xoay thoát theo hướng trống. Mất bóng thì người gần nhất áp sát ngay, đồng đội che đường chuyền gần; đoạt bóng thì tìm hướng tiến lên ngay.',
    conditionedGame: 'Trò chơi đối kháng sân nhỏ có điều kiện: Thi đấu trong không gian hẹp với 4 cầu môn mini ở 4 góc. Bàn thắng bình thường tính một điểm; bàn thắng tính hai điểm khi trước đó có pha nhận bóng thoát áp lực gần bằng bật tường và chạy nhận lại. Khi đổi quyền kiểm soát, đội vừa đoạt bóng tìm đường chuyền tiến lên ngay; đội mất bóng thu hẹp các lựa chọn chuyền gần.',
    finalMatch: 'Trận đấu thực chiến Futsal trên sân tiêu chuẩn với 2 khung thành Futsal có thủ môn. Áp dụng luật Futsal chuẩn, bàn thắng bình thường luôn tính một điểm. Chỉ áp dụng một điều kiện thưởng điểm đơn giản: bàn thắng tính hai điểm nếu tình huống xuất phát từ pha nhận bóng mở góc thoát áp lực và đẩy bóng tiến lên. Cầu thủ tự do ra quyết định, huấn luyện viên can thiệp tối thiểu.',
    warmUpPoints: [
      'Quay đầu kiểm tra vai trước khi bóng đến trong không gian hẹp.',
      'Hạ thấp trọng tâm, đứng tư thế mở người nhìn thấy cả bóng lẫn hướng chạy.',
      'Tiếp xúc bóng êm bằng gầm giày hoặc lòng trong, giữ bóng trong tầm kiểm soát.',
    ],
    technicalPoints: [
      'Đón bóng bằng chân xa hướng về phía khoảng trống thoát áp.',
      'Chạm bước một định hướng thoát khỏi tầm với của đối thủ giả định.',
      'Nếu bị khóa lưng: nhả một chạm chuẩn xác rồi lập tức bứt tốc đón đường bật tường.',
    ],
    skillPoints: [
      'Đọc thời điểm và tốc độ áp sát của hậu vệ đối phương sau lưng.',
      'Ra quyết định dứt khoát: bật tường nhanh khi bị áp sát hoặc xoay người khi có khe hở.',
      'Đồng đội gần nhất lập tức di chuyển tạo góc chuyền chéo hỗ trợ.',
    ],
    conditionedGamePoints: [
      'Tạo khối tam giác hỗ trợ cự ly ngắn (3–5m) đặc trưng Futsal.',
      'Phản xạ chuyển trạng thái cực nhanh ngay khi đoạt hoặc mất bóng.',
      'Khai thác khoảng trống chuyển đổi trước khi đối thủ kịp lui về bịt góc.',
    ],
    finalMatchPoints: [
      'Chuyển hóa kỹ năng bật tường và nhận bóng thoát áp lực vào trận đấu thực tế.',
      'Cầu thủ tự tin và chủ động đưa ra quyết định xử lý tình huống trên sân.',
      'Huấn luyện viên can thiệp tối thiểu để các cầu thủ tự làm chủ nhịp điệu thi đấu.',
    ],
    warmUpProgression: 'Tăng dần tốc độ di chuyển của người chuyền; đổi góc tiếp cận bóng sau mỗi 2 phút.',
    technicalProgression: 'Giới hạn 1 chạm cho đường chuyền bật tường; rút ngắn khoảng cách trạm kỹ thuật để tăng tốc độ xử lý.',
    skillProgression: 'Cho phép người phòng ngự áp sát quyết liệt hơn ngay từ khi bóng rời chân người chuyền.',
    conditionedGameProgression: 'Quy định đội phòng ngự chỉ được lui về nửa sân sau khi đối thủ thực hiện đủ 3 đường chuyền liên tiếp.',
    finalMatchProgression: 'Tháo bỏ dần luật thưởng điểm để toàn đội thi đấu theo luật Futsal thuần túy.',
    equipment: {
      warm_up: ['12 Nón nấm', '6 Quả bóng Futsal', 'Áo bib 2 màu'],
      technical: ['8 Cọc tiêu kỹ thuật', '8 Nón nấm', '6 Quả bóng Futsal', 'Áo bib'],
      skill: ['10 Nón phân khu vực', '6 Quả bóng Futsal', 'Áo bib 3 màu'],
      small_sided: ['4 Khung thành mini', '6 Quả bóng Futsal', 'Áo bib 2 đội', 'Nón đánh dấu'],
      match: ['2 Khung thành Futsal', 'Bóng Futsal tiêu chuẩn', 'Áo bib 2 màu'],
    },
  },
  '7v7': {
    focus: 'Tam giác hỗ trợ gần, cầu thủ biên tạo chiều rộng và điểm tựa trung tâm nối các nhóm gần nhau trong hướng tấn công rõ ràng.',
    technicalName: 'Nhận nghiêng người nối tam giác biên – trung tâm',
    setup: 'Tạo góc tam giác giữa điểm tựa phía sau, vị trí nhận trung tâm và hướng chuyền ra biên; giữ các điểm hỗ trợ đủ gần để phối hợp tiến lên.',
    warmUp: 'Trong từng cặp, người nhận đứng lệch khỏi đường chuyền thẳng, nhìn bóng và hướng tiến lên cùng lúc. Nhận bằng chân xa rồi chuyền vào góc di chuyển mới của bạn; cả hai dịch chuyển theo hướng tấn công.',
    technical: 'Bóng bắt đầu ở điểm tựa phía sau của mỗi nhóm nhỏ. Người nhận trung tâm đứng nghiêng để nhìn cả người chuyền và hướng biên, nhận chân xa rồi nối bóng ra biên. Người chuyền ban đầu tiến lên tạo góc tam giác mới để nhận lại đường chuyền hướng trước; các thành viên đổi vai theo đường bóng, điểm nối còn lại luân phiên vào vị trí trung tâm.',
    skill: 'Trong hai đội đã chia, cầu thủ biên mở rộng vừa đủ, người trung tâm xuất hiện lệch khỏi người kèm và người phía sau luôn cho một đường trả bóng. Người nhận trung tâm chọn chuyền lên nếu hướng trước mở; nếu bị khóa thì chọn hướng biên còn trống, nhả về hoặc che bóng, rồi di chuyển tạo lại tam giác gần bóng.',
    conditionedGame: 'Trò chơi đối kháng sân nhỏ có điều kiện: Sân chia làm 3 hành lang (trung tâm và 2 biên) với 4 cầu môn nhỏ ở các góc. Hai đội thi đấu có thưởng điểm chiến thuật: Bàn thắng bình thường tính một điểm. Bàn thắng tính hai điểm nếu trong cùng lượt kiểm soát bóng, đội hoàn thành đường chuyền từ hành lang trung tâm ra hành lang biên, sau đó hoàn thành đường chuyền cho đồng đội đứng gần cầu môn đối phương hơn người chuyền. Dùng nón đánh dấu hành lang trung tâm và hai hành lang biên. Không chấm điểm theo tư thế thân người; người nhận được chọn xoay, nhả về, che bóng hoặc đổi hướng theo áp lực, không bắt buộc chuyền lên. Khi mất bóng, các cầu thủ gần nhau thu hẹp cự ly để bảo vệ hướng trung tâm.',
    finalMatch: 'Trận đấu thực chiến trên sân 7 tiêu chuẩn với 2 khung thành sân 7 có thủ môn. Áp dụng luật thi đấu bóng đá 7 người đầy đủ (ném biên, phạt góc, đá phạt). Bàn thắng bình thường luôn được tính một điểm hợp lệ. Chỉ áp dụng một luật thưởng điểm đơn giản: bàn thắng được tính hai điểm nếu pha tấn công xuất phát từ tình huống nhận bóng mở thân người tịnh tiến qua tuyến đối phương. Không gò bó quyết định của cầu thủ; cầu thủ hoàn toàn tự do sút, chuyền hoặc rê bóng tùy tình huống thực tế, huấn luyện viên can thiệp tối thiểu.',
    warmUpPoints: [
      'Kiểm tra vai trước khi bóng tới để nhận biết không gian xung quanh.',
      'Đứng lệch góc mở thân người, nhìn thấy cả bóng lẫn hướng di chuyển tiếp theo.',
      'Tiếp xúc bóng êm bằng lòng trong, giữ bóng trong tầm khống chế chủ động.',
    ],
    technicalPoints: [
      'Đón bóng bằng chân xa để mở góc tịnh tiến sang hướng biên tiếp theo.',
      'Chạm bước một định hướng về phía trước vào khoảng trống, không hãm chết bóng tại chỗ.',
      'Xoay hông và mở ngực về phía mục tiêu định chuyền trước khi bóng chạm chân.',
    ],
    skillPoints: [
      'Cảm nhận góc tiếp cận và khoảng cách áp sát của hậu vệ đối phương sau lưng.',
      'Nếu hướng trước mở: xoay người tịnh tiến; nếu bị áp sát rát: nhả về điểm tựa một chạm hoặc che bóng.',
      'Di chuyển tạo góc tam giác hỗ trợ mới ngay sau khi chuyền bóng, không đứng yên nhìn bóng.',
    ],
    conditionedGamePoints: [
      'Cầu thủ biên mở rộng vừa đủ, người trung tâm chọn thời điểm xuất hiện giữa các tuyến.',
      'Khai thác thời điểm đối thủ dồn sang phía bóng để chuyển hướng tấn công sang cánh đối diện.',
      'Khi mất bóng, các vị trí gần bóng lập tức thu hẹp cự ly để bảo vệ hướng trung tâm.',
    ],
    finalMatchPoints: [
      'Chuyển hóa thói quen quan sát vai và mở thân người vào các tình huống thi đấu thực tế.',
      'Tự tin tự đưa ra quyết định xử lý bóng (sút, chuyền hoặc rê dắt) dựa trên khoảng trống thực tế.',
      'Huấn luyện viên can thiệp tối thiểu để cầu thủ làm chủ hoàn toàn nhịp điệu trận đấu.',
    ],
    warmUpProgression: 'Đổi chân nhận bóng và đổi hướng tiếp cận sau mỗi lượt chuyền, duy trì áp lực thấp.',
    technicalProgression: 'Giới hạn tối đa 2 chạm để tăng tốc độ luân chuyển; đổi chiều luân chuyển bóng để rèn luyện cả hai chân.',
    skillProgression: 'Người phòng ngự được phép áp sát tranh chấp quyết liệt hơn ngay từ khi bóng lăn; thu hẹp thời gian ra quyết định của người nhận.',
    conditionedGameProgression: 'Giới hạn thời gian tấn công (15 giây sau khi đoạt bóng) để thúc đẩy nhịp độ tịnh tiến bóng về phía trước.',
    finalMatchProgression: 'Tháo bỏ dần điều kiện thưởng điểm để chuyển hoàn toàn sang thi đấu bóng đá tự nhiên theo luật chuẩn.',
    equipment: {
      warm_up: ['12 Nón tập 2 màu', '8 Quả bóng', 'Áo bib 2 màu'],
      technical: ['6 Cọc tiêu kỹ thuật', '10 Nón nấm', '8 Quả bóng', 'Áo bib'],
      skill: ['12 Nón phân làn', '8 Quả bóng', 'Áo bib 3 màu'],
      small_sided: ['4 Khung thành nhỏ', '10 Quả bóng', 'Áo bib 2 đội', 'Nón đánh dấu 3 hành lang'],
      match: ['2 Khung thành sân 7', 'Bóng thi đấu tiêu chuẩn', 'Áo bib 2 màu'],
    },
  },
  '9v9': {
    focus: 'Chiều rộng và chiều sâu rõ hơn, liên kết tiền vệ – tiền đạo, nhận giữa các tuyến với hỗ trợ sau và trước bóng; đổi cánh khi một bên bị khóa.',
    technicalName: 'Nhận giữa tuyến, nối chiều sâu hoặc đổi cánh',
    setup: 'Các vị trí trong nhóm đứng so le trước và sau bóng, có hướng mở ra biên. Trong đối kháng, giữ chiều rộng hai phía và chiều sâu giữa khu vực tiền vệ với người chơi cao hơn.',
    warmUp: 'Trong từng cặp, người nhận kiểm tra cả vai phía trước lẫn hướng biên, mở thân người nhận bóng rồi dẫn một nhịp theo chiều sâu trước khi trả bóng. Người chuyền lùi lệch làm điểm hỗ trợ phía sau; đổi vai liên tục.',
    technical: 'Trong mỗi nhóm nhỏ, bóng bắt đầu từ vị trí hỗ trợ phía sau. Người nhận di chuyển vào khoảng trống đại diện giữa tuyến tiền vệ và người chơi cao hơn, mở thân người nhìn trước bóng rồi chuyền vào hướng chiều sâu. Lượt kế tiếp, hướng trước bị khóa theo tín hiệu của bạn tập thì nhả về điểm tựa để chuyển bóng sang hướng biên đối diện. Luân phiên các vị trí sau mỗi đường chuyền, tập cả hai hướng.',
    skill: 'Trong hai đội đã chia, cầu thủ biên kéo rộng và người chơi cao hơn giữ chiều sâu để người nhận tìm khoảng trống giữa các tuyến. Người nhận kiểm tra hỗ trợ phía sau và phía trước: xoay nối với người chơi cao nếu có thời gian, hoặc nhả về cho đồng đội đổi cánh khi đối thủ dồn sang phía bóng.',
    conditionedGame: 'Trò chơi đối kháng sân nhỏ có điều kiện: Thi đấu 9v9 thu nhỏ chia 3 khu vực với 2 khung thành có thủ môn. Bàn thắng bình thường tính một điểm; bàn thắng tính hai điểm khi pha tấn công có nhận bóng giữa các tuyến rồi chuyền thành công theo chiều sâu, hoặc nhả về và đổi cánh để thoát phía bị dồn ép. Đồng đội phải duy trì một lựa chọn sau bóng và một lựa chọn trước bóng.',
    finalMatch: 'Trận đấu thực chiến trên sân 9 người tiêu chuẩn với 2 khung thành sân 9 và thủ môn. Áp dụng luật thi đấu bóng đá 9 người hoàn chỉnh. Bàn thắng bình thường luôn tính một điểm. Chỉ áp dụng một luật thưởng điểm đơn giản: bàn thắng tính hai điểm nếu xuất phát từ pha nhận bóng mở góc giữa hai tuyến và tịnh tiến lên phía trước. Cầu thủ tự do xử lý theo tình huống thực chiến, huấn luyện viên can thiệp tối thiểu.',
    warmUpPoints: [
      'Kiểm tra vai cả hướng trung lộ lẫn hướng biên trước khi bóng đến.',
      'Mở thân người về hướng không gian có chiều sâu tấn công.',
      'Chạm bước một định hướng tiến về phía trước theo hướng mở.',
    ],
    technicalPoints: [
      'Đón bóng bằng chân xa để mở toàn bộ góc nhìn về phía tiền đạo.',
      'Đỡ bóng hướng về phía trước, sẵn sàng cho đường chuyền theo chiều sâu.',
      'Chuyền bóng căng sệt đúng đà di chuyển của người chơi tuyến trên.',
    ],
    skillPoints: [
      'Đọc vị trí và bóng che của hàng tiền vệ đối phương trước khi nhận bóng.',
      'Nếu có khoảng trống giữa các tuyến: xoay người tịnh tiến; nếu bị dồn ép: nhả về điểm tựa đổi cánh.',
      'Duy trì đồng thời một lựa chọn hỗ trợ sau bóng và một lựa chọn trước bóng.',
    ],
    conditionedGamePoints: [
      'Khai thác tối đa chiều rộng của sân 9 người để kéo giãn cự ly đối thủ.',
      'Chuyển hướng tấn công sang cánh xa khi đối phương dồn ép một bên.',
      'Căn thời điểm tiền đạo xâm nhập đón đường chuyền xuyên tuyến.',
    ],
    finalMatchPoints: [
      'Chuyển hóa khả năng nhận bóng giữa các tuyến và đổi cánh vào thi đấu 9v9 thực tế.',
      'Tự tin làm chủ không gian rộng và phối hợp tự nhiên theo nhóm tuyến.',
      'Huấn luyện viên can thiệp tối thiểu, để cầu thủ tự giải quyết các tình huống trên sân.',
    ],
    warmUpProgression: 'Tăng cự ly chuyền bóng từ 10m lên 15m; đổi chân khống chế bóng sau mỗi lượt.',
    technicalProgression: 'Đổi tín hiệu khóa hướng chuyền sâu để người nhận tập đổi cánh sang biên đối diện.',
    skillProgression: 'Tăng thêm một hậu vệ áp sát để tạo áp lực 2 chiều lên người nhận bóng.',
    conditionedGameProgression: 'Giới hạn số lần chạm bóng ở khu vực giữa sân (tối đa 2 chạm) để đẩy nhanh tốc độ luân chuyển.',
    finalMatchProgression: 'Tháo bỏ dần điều kiện điểm thưởng để cầu thủ thi đấu hoàn toàn tự nhiên theo luật 9v9.',
    equipment: {
      warm_up: ['14 Nón tập', '10 Quả bóng', 'Áo bib 2 màu'],
      technical: ['8 Cọc tiêu', '12 Nón nấm', '10 Quả bóng', 'Áo bib'],
      skill: ['14 Nón phân khu vực chiều sâu', '10 Quả bóng', 'Áo bib 3 màu'],
      small_sided: ['2 Khung thành sân 9', '10 Quả bóng', 'Áo bib 2 đội', 'Nón phân khu vực'],
      match: ['2 Khung thành sân 9', 'Bóng thi đấu tiêu chuẩn', 'Áo bib 2 màu'],
    },
  },
  '11v11': {
    focus: 'Liên kết hậu vệ – tiền vệ – tiền đạo, vai trò vị trí và nhận giữa tuyến tiền vệ với tuyến phòng ngự đối phương trong bối cảnh chiều rộng toàn đội; dùng các tuyến đại diện theo quân số hiện có.',
    technicalName: 'Nhận giữa hai tuyến và nối bóng qua người thứ ba',
    setup: 'Trong nhóm nhỏ, các vị trí luân phiên đại diện hậu vệ triển khai, tiền vệ nhận và người chơi phía trên. Trong đối kháng, trải vị trí theo chiều rộng và các tuyến đại diện, không bổ sung người cho đủ đội hình tiêu chuẩn.',
    warmUp: 'Trong từng cặp, người chuyền đóng vai vị trí triển khai, người nhận mở góc thân người về hướng tuyến kế tiếp được đánh dấu. Kiểm tra vai trước khi nhận, chạm chân xa qua hướng tuyến rồi trả bóng; đổi vai và hướng ngay lượt sau.',
    technical: 'Bóng bắt đầu ở vị trí đại diện hậu vệ của mỗi nhóm nhỏ. Tiền vệ di chuyển lệch khỏi bóng che của đối thủ giả định, nhận ở khoảng giữa tuyến tiền vệ và phòng ngự được đánh dấu. Nếu quay được thì nối bóng lên vị trí đại diện tiền đạo; nếu bị khóa lưng thì nhả cho điểm hỗ trợ để người thứ ba chuyền xuyên hướng tuyến. Các vai do chính thành viên nhóm luân phiên đảm nhiệm, đổi sau mỗi lượt, không ghép thành một nhóm lớn.',
    skill: 'Trong hai đội đã chia, phân vai tuyến dưới, tuyến giữa và người chơi cao bằng chính quân số hiện có. Bóng triển khai từ tuyến dưới; người nhận tìm khoảng trống giữa tuyến tiền vệ và phòng ngự đối phương, kiểm tra bóng che và áp lực sau lưng để xoay nối tuyến trên hoặc nhả cho người thứ ba. Các vị trí xa bóng giữ chiều rộng, người phía sau giữ điểm tựa khi đường xuyên tuyến bị chặn.',
    conditionedGame: 'Trò chơi đối kháng sân nhỏ có điều kiện: Thi đấu đại diện 11v11 trên nửa sân lớn có phân định 3 tuyến với 2 khung thành và thủ môn. Bàn thắng bình thường tính một điểm; bàn thắng tính hai điểm khi chuỗi triển khai nối được tuyến dưới qua người nhận giữa các tuyến tới tuyến trên, trực tiếp hoặc qua người thứ ba. Khi đối thủ pressing theo tuyến, đội có bóng dùng điểm tựa phía sau và chiều rộng để mở lại đường xuyên tuyến; duy trì đội hình đại diện theo quân số hiện có.',
    finalMatch: 'Trận đấu thực chiến thể thức đại diện 11v11 trên nửa sân lớn với 2 khung thành tiêu chuẩn có thủ môn. Áp dụng luật thi đấu bóng đá chuẩn mực. Bàn thắng bình thường luôn tính một điểm. Chỉ áp dụng một luật thưởng điểm đơn giản: bàn thắng tính hai điểm nếu xuất phát từ pha nhận bóng mở góc giữa hai tuyến và phối hợp tịnh tiến lên phía trước. Cầu thủ tự chủ chiến thuật, huấn luyện viên can thiệp tối thiểu.',
    warmUpPoints: [
      'Quan sát vai quét qua các tuyến đại diện được đánh dấu trên sân.',
      'Đứng tư thế nửa thân người 45 độ, nhìn thấy người triển khai và hướng tuyến kế tiếp.',
      'Khống chế bước một đẩy bóng về hướng tuyến trên với lực vừa tầm.',
    ],
    technicalPoints: [
      'Nhận bóng bằng chân xa lệch khỏi bóng che của đối thủ giả định.',
      'Cơ chế đỡ bước một hướng lên tuyến trên ngay từ chạm đầu tiên.',
      'Chuyền bóng đúng nhịp vào đà di chuyển của người thứ ba.',
    ],
    skillPoints: [
      'Nhận diện khoảng cách giữa tuyến tiền vệ và tuyến phòng ngự đối phương.',
      'Ra quyết định: xoay người chọc khe nếu rảnh chân, nhả bóng cho người thứ ba nếu bị áp sát lưng.',
      'Các vị trí xa bóng giữ cự ly chiều rộng đội hình để mở góc chuyền giải tỏa.',
    ],
    conditionedGamePoints: [
      'Tổ chức cự ly các tuyến đại diện (hậu vệ – tiền vệ – tiền đạo) cân bằng trên sân lớn.',
      'Phối hợp người thứ ba để phá vỡ khối pressing theo tuyến của đối thủ.',
      'Chuyển đổi trạng thái nhanh khi đoạt bóng: đưa bóng ngay tới người nhận giữa các tuyến.',
    ],
    finalMatchPoints: [
      'Vận dụng cự ly liên kết tuyến và khả năng nhận bóng giữa hai tuyến vào thực tế thi đấu.',
      'Cầu thủ tự do ra quyết định chiến thuật theo diễn biến thực tế trên sân.',
      'Huấn luyện viên can thiệp tối thiểu để đánh giá tính chủ động của toàn đội.',
    ],
    warmUpProgression: 'Mở rộng cự ly di chuyển giữa các cặp; luân phiên thay đổi vai trò người triển khai.',
    technicalProgression: 'Thay đổi hướng di chuyển của người nhận (từ trong ra biên và từ biên vào trung lộ).',
    skillProgression: 'Tuyến phòng ngự đối phương được phép linh hoạt dâng cao hoặc lùi sâu để thử thách khả năng đọc tình huống.',
    conditionedGameProgression: 'Áp dụng quy tắc cộng điểm nếu bàn thắng xuất phát từ chuỗi kết nối đủ cả 3 tuyến.',
    finalMatchProgression: 'Trận đấu diễn ra theo luật bóng đá 11 người thực chiến hoàn toàn tự nhiên.',
    equipment: {
      warm_up: ['16 Nón tập', '10 Quả bóng', 'Áo bib 2 màu'],
      technical: ['10 Cọc tiêu kỹ thuật', '16 Nón nấm', '10 Quả bóng', 'Áo bib'],
      skill: ['16 Nón phân tuyến', '10 Quả bóng', 'Áo bib 3 màu'],
      small_sided: ['2 Khung thành tiêu chuẩn', '10 Quả bóng', 'Áo bib 2 đội', 'Nón đánh dấu tuyến'],
      match: ['2 Khung thành tiêu chuẩn', 'Bóng thi đấu tiêu chuẩn', 'Áo bib 2 màu'],
    },
  },
};

export function gameFormatTacticalGuidance(format: GameFormat): string {
  const context = CONTEXT[format];
  return `${context.focus}
Kỹ thuật: ${context.technical}
Kỹ năng: ${context.skill}
Điều kiện trò chơi: ${context.conditionedGame}
Trận đấu cuối: ${context.finalMatch}
Áp dụng các quan hệ này vào chủ đề đang tập, không đổi chủ đề. Phải khác về lựa chọn xử lý, di chuyển hỗ trợ và điều kiện ghi điểm, không chỉ khác tên hay kích thước. Các quan hệ cục bộ là tình huống trong quân số đã chia, không phải cầu thủ bổ sung. Kỹ thuật luôn tập song song theo nhóm nhỏ, đổi vai nhanh.`;
}

export function formatPhaseContent(format: GameFormat, block: BlockType, topic: string, base: {
  exerciseName: string; execution: string; coachingPoints: string[]; progression?: string; equipment?: string[];
}) {
  const context = CONTEXT[format];
  const receiving = /nhận bóng|mở thân|quan sát/i.test(topic);

  let behavior: string;
  let points: string[];
  let prog: string;

  if (block === 'warm_up') {
    behavior = context.warmUp;
    points = context.warmUpPoints;
    prog = context.warmUpProgression;
  } else if (block === 'technical') {
    behavior = context.technical;
    points = context.technicalPoints;
    prog = context.technicalProgression;
  } else if (block === 'skill') {
    behavior = context.skill;
    points = context.skillPoints;
    prog = context.skillProgression;
  } else if (block === 'small_sided') {
    behavior = context.conditionedGame;
    points = context.conditionedGamePoints;
    prog = context.conditionedGameProgression;
  } else {
    behavior = context.finalMatch;
    points = context.finalMatchPoints;
    prog = context.finalMatchProgression;
  }

  const phaseEquipment = context.equipment[block] || base.equipment || ['Bóng', 'Cọc tiêu', 'Áo bib'];

  return {
    exerciseName: !receiving || block === 'match' ? base.exerciseName : `${topic}: ${block === 'technical' ? context.technicalName :
      block === 'warm_up' ? 'Kích hoạt – ' + context.technicalName :
        block === 'skill' ? 'Đối kháng – ' + context.technicalName : 'Trò chơi – ' + context.technicalName}`,
    execution: receiving ? behavior : `${base.execution}\nBối cảnh ${format}: ${context.focus} Vận dụng ${topic} trong các quan hệ hỗ trợ này.`,
    coachingPoints: receiving ? points : base.coachingPoints,
    progression: receiving ? prog : (base.progression || prog),
    equipment: phaseEquipment,
    spatialSetup: block === 'warm_up' ? 'Các cặp hoạt động đồng thời, nhận bóng ở góc lệch và đổi vị trí theo đường bóng; giữ áp lực thấp.' : context.setup,
  };
}
